import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@novaconnect/core/types'

/**
 * Routes publiques (ne nécessitent pas d'authentification)
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/unauthorized',
]

/**
 * Routes protégées par rôle
 * Map: route_pattern -> rôles autorisés
 */
const PROTECTED_ROUTES: Record<string, UserRole[]> = {
  '/super-admin': ['super_admin'],
  '/admin': ['school_admin', 'super_admin'],
  '/accountant': ['accountant', 'school_admin', 'super_admin'],
  '/teacher': ['teacher', 'school_admin', 'super_admin'],
  '/student': ['student'],
  '/parent': ['parent'],
}

const getDefaultDashboardPath = (role: UserRole): string => {
  switch (role) {
    case 'super_admin':
      return '/super-admin'
    case 'school_admin':
      return '/admin'
    case 'accountant':
      return '/accountant'
    case 'teacher':
      return '/teacher'
    case 'student':
      return '/student'
    case 'parent':
      return '/parent'
    case 'supervisor':
      return '/supervisor'
    default:
      return '/login'
  }
}

/**
 * Middleware Next.js pour protection des routes
 *
 * Ce middleware :
 * - Vérifie la session utilisateur côté serveur via Supabase
 * - Protège les routes selon les rôles autorisés
 * - Redirige vers /login si non authentifié
 * - Redirige vers /unauthorized si rôle insuffisant
 * - Redirige vers le dashboard approprié après login selon le rôle
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Créer un client Supabase côté serveur
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string) {
          request.cookies.set(name, value)
        },
        remove(name: string) {
          request.cookies.delete(name)
        },
      },
    }
  )

  // Récupérer la session utilisateur
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // ============================================
  // 1. Gérer les routes publiques
  // ============================================
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route)
  )

  if (isPublicRoute) {
    // Si l'utilisateur est déjà authentifié et essaie d'accéder à /login ou /register
    // Rediriger vers son dashboard approprié
    if (session && (pathname === '/login' || pathname === '/register')) {
      // Récupérer le rôle de l'utilisateur depuis les claims Supabase
      const userRole = (session.user?.user_metadata?.role ||
        session.user?.app_metadata?.role ||
        session.user?.role) as UserRole

      if (userRole) {
        const dashboardPath = getDefaultDashboardPath(userRole)
        return NextResponse.redirect(new URL(dashboardPath, request.url))
      }

      // Fallback vers /admin par défaut
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    // Sinon, continuer vers la route publique
    return NextResponse.next()
  }

  // ============================================
  // 2. Vérifier l'authentification pour les routes protégées
  // ============================================
  if (!session) {
    // Non authentifié → rediriger vers /login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ============================================
  // 3. Vérifier les autorisations par rôle
  // ============================================
  const userRole = (session.user?.user_metadata?.role ||
    session.user?.app_metadata?.role ||
    session.user?.role) as UserRole

  if (!userRole) {
    // Rôle non trouvé → rediriger vers /unauthorized
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  // Trouver la route qui correspond au pathname
  const matchingRoute = Object.keys(PROTECTED_ROUTES).find(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  if (matchingRoute) {
    const allowedRoles = PROTECTED_ROUTES[matchingRoute]

    // Vérifier si le rôle de l'utilisateur est autorisé
    // allowedRoles peut être undefined si la route n'est pas dans le map (bien que vérifié par matchingRoute)
    const isAuthorized = allowedRoles
      ? allowedRoles.includes(userRole) || userRole === 'super_admin'
      : false

    if (!isAuthorized) {
      // Rôle insuffisant → rediriger vers /unauthorized
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  // ============================================
  // 3b. Rate Limiting
  // ============================================
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')
  ) {
    try {
      // Use client IP as identifier
      const ip = request.headers.get('x-forwarded-for') || 'unknown-ip'

      // Import dynamically to avoid top-level side effects in Edge if needed
      const { globalRateLimiter, authRateLimiter } = await import('@/lib/rate-limit')

      const isAuthRoute =
        pathname.startsWith('/login') ||
        pathname.startsWith('/register') ||
        pathname.startsWith('/api/auth')
      const limiter = isAuthRoute ? authRateLimiter : globalRateLimiter

      // Get limit from config (ugly but effective way to get private config or default)
      const limit = isAuthRoute ? 10 : 100

      await limiter.check(limit, ip)
    } catch (error) {
      console.error('Rate limit exceeded for IP:', request.headers.get('x-forwarded-for'))
      return new NextResponse(
        JSON.stringify({ error: 'Too Many Requests', message: 'Veuillez réessayer plus tard.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // ============================================
  // 4. Ajouter les headers de sécurité
  // ============================================
  const response = NextResponse.next()

  // Debug headers - development only (security risk in production)
  if (process.env.NODE_ENV === 'development') {
    response.headers.set('x-user-id', session.user?.id || '')
    response.headers.set('x-user-role', userRole || '')
  }

  return response
}

/**
 * Configuration du matcher pour définir quelles routes utilisent le middleware
 *
 * Ce matcher inclut toutes les routes SAUF :
 * - Les fichiers statiques (_next/static, _next/image)
 * - Les fichiers publics (favicon.ico, images, etc.)
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
