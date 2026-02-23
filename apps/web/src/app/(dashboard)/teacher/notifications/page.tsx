'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Bell,
    CheckCircle,
    XCircle,
    BookOpen,
    FileText,
    Calendar,
    AlertTriangle,
    CreditCard,
    TrendingUp,
    User,
    Check,
    Filter,
    ArrowLeft,
    Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import {
    useAuthContext,
    useNotifications,
    useMarkNotificationAsRead,
    useMarkAllNotificationsAsRead,
    useUnreadNotificationsCount,
} from '@novaconnect/data';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function TeacherNotificationsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useAuthContext();

    // Filters
    const [selectedType, setSelectedType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read'>('all');

    // Fetch notifications
    const { data: notifications = [], isLoading, refetch } = useNotifications(user?.id || '', {
        limit: 50,
    });

    // Fetch unread count
    const { data: unreadCount = 0 } = useUnreadNotificationsCount(user?.id || '');

    // Mutations
    const markAsReadMutation = useMarkNotificationAsRead();
    const markAllAsReadMutation = useMarkAllNotificationsAsRead();

    // Filter notifications
    const filteredNotifications = notifications.filter((notification: any) => {
        if (selectedType !== 'all' && notification.type !== selectedType) return false;
        if (filterStatus === 'unread' && notification.readAt) return false;
        if (filterStatus === 'read' && !notification.readAt) return false;
        return true;
    });

    // Get notification icon and color
    const getNotificationIcon = (type: string) => {
        const icons: Record<string, any> = {
            grade_published: { icon: TrendingUp, color: 'text-blue-600 bg-blue-100' },
            grade_posted: { icon: TrendingUp, color: 'text-blue-600 bg-blue-100' },
            schedule_published: { icon: Calendar, color: 'text-purple-600 bg-purple-100' },
            schedule_updated: { icon: Calendar, color: 'text-purple-600 bg-purple-100' },
            assignment_published: { icon: BookOpen, color: 'text-orange-600 bg-orange-100' },
            lesson_validated: { icon: CheckCircle, color: 'text-green-600 bg-green-100' },
            payment_received: { icon: CreditCard, color: 'text-green-600 bg-green-100' },
            announcement: { icon: Info, color: 'text-indigo-600 bg-indigo-100' },
            class_assigned: { icon: User, color: 'text-cyan-600 bg-cyan-100' },
        };

        return icons[type] || { icon: Bell, color: 'text-gray-600 bg-gray-100' };
    };

    // Get notification type label
    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            grade_published: 'Note publiée',
            grade_posted: 'Note publiée',
            schedule_published: 'Emploi du temps publié',
            schedule_updated: 'Emploi du temps mis à jour',
            assignment_published: 'Devoir publié',
            lesson_validated: 'Cours validé',
            payment_received: 'Paiement reçu',
            announcement: 'Annonce',
            class_assigned: 'Classe assignée',
        };

        return labels[type] || type;
    };

    // Group notifications by date
    const groupNotificationsByDate = (notifList: any[]) => {
        const groups: Record<string, any[]> = {
            today: [],
            week: [],
            month: [],
            older: [],
        };

        const now = new Date();

        notifList.forEach((notif: any) => {
            const notifDate = new Date(notif.sentAt || notif.createdAt);
            const daysDiff = Math.floor((now.getTime() - notifDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff === 0) {
                groups.today.push(notif);
            } else if (daysDiff < 7) {
                groups.week.push(notif);
            } else if (daysDiff < 30) {
                groups.month.push(notif);
            } else {
                groups.older.push(notif);
            }
        });

        return groups;
    };

    const groupedNotifications = groupNotificationsByDate(filteredNotifications);

    // Handle marking as read
    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await markAsReadMutation.mutateAsync(notificationId);
            refetch();
        } catch (error) {
            toast({
                title: 'Erreur',
                description: 'Impossible de marquer comme lu',
                variant: 'destructive',
            });
        }
    };

    // Handle marking all as read
    const handleMarkAllAsRead = async () => {
        try {
            await markAllAsReadMutation.mutateAsync(user?.id || '');
            refetch();
            toast({
                title: 'Succès',
                description: 'Toutes les notifications ont été marquées comme lues',
            });
        } catch (error) {
            toast({
                title: 'Erreur',
                description: 'Impossible de marquer toutes comme lues',
                variant: 'destructive',
            });
        }
    };

    // Handle notification click
    const handleNotificationClick = (notification: any) => {
        // Mark as read
        if (!notification.readAt) {
            handleMarkAsRead(notification.id);
        }

        // Navigate based on notification type
        const typeRoutes: Record<string, string> = {
            grade_published: '/teacher/grades',
            grade_posted: '/teacher/grades',
            schedule_published: '/teacher/schedule',
            schedule_updated: '/teacher/schedule',
            class_assigned: '/teacher/classes',
        };

        const route = typeRoutes[notification.type];
        if (route) {
            router.push(route);
        }
    };

    const userName = user?.user_metadata
        ? `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim()
        : user?.email || 'Enseignant';

    // Get all unique notification types
    const notificationTypes = Array.from(new Set(notifications.map((n: any) => n.type)));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
            <div className="mx-auto w-full max-w-4xl px-3 sm:px-6 py-4 sm:py-6">
                {/* Header */}
                <div className="mb-4 sm:mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push('/teacher')}
                                className="text-gray-600"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                                <Bell className="h-5 w-5 sm:h-7 sm:w-7" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">
                                    Notifications
                                </h1>
                                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600">
                                    {userName}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Badge
                                variant={unreadCount > 0 ? 'default' : 'secondary'}
                                className="text-xs"
                            >
                                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                            </Badge>
                            {unreadCount > 0 && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs"
                                    disabled={markAllAsReadMutation.isPending}
                                >
                                    <Check className="mr-1 h-3 w-3" />
                                    Tout marquer comme lu
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <Card className="mb-4 sm:mb-6 border-border/60 bg-white/80 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            Filtres
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                            {/* Status Filter */}
                            <div className="space-y-1.5 sm:space-y-2">
                                <label className="text-xs font-medium text-gray-700">Statut</label>
                                <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                                    <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Toutes</SelectItem>
                                        <SelectItem value="unread">Non lues</SelectItem>
                                        <SelectItem value="read">Lues</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Type Filter */}
                            <div className="space-y-1.5 sm:space-y-2">
                                <label className="text-xs font-medium text-gray-700">Type</label>
                                <SearchableSelect
                                    options={notificationTypes.map((type) => ({ value: type, label: getTypeLabel(type) }))}
                                    value={selectedType}
                                    onValueChange={setSelectedType}
                                    placeholder="Tous les types"
                                    searchPlaceholder="Rechercher un type..."
                                    allLabel="Tous les types"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Notifications List */}
                {isLoading ? (
                    <Card className="border-border/60 bg-white/80 shadow-sm">
                        <CardContent className="py-12 text-center text-sm text-gray-500">
                            Chargement...
                        </CardContent>
                    </Card>
                ) : filteredNotifications.length === 0 ? (
                    <Card className="border-border/60 bg-white/80 shadow-sm">
                        <CardContent className="py-12 text-center">
                            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-sm text-gray-500">
                                Aucune notification trouvée
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4 sm:space-y-6">
                        {/* Today */}
                        {groupedNotifications.today.length > 0 && (
                            <div>
                                <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-2 sm:mb-3 px-1">
                                    Aujourd'hui
                                </h3>
                                <div className="space-y-2">
                                    {groupedNotifications.today.map((notification: any) => (
                                        <NotificationCard
                                            key={notification.id}
                                            notification={notification}
                                            onClick={() => handleNotificationClick(notification)}
                                            getNotificationIcon={getNotificationIcon}
                                            getTypeLabel={getTypeLabel}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* This Week */}
                        {groupedNotifications.week.length > 0 && (
                            <div>
                                <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-2 sm:mb-3 px-1">
                                    Cette semaine
                                </h3>
                                <div className="space-y-2">
                                    {groupedNotifications.week.map((notification: any) => (
                                        <NotificationCard
                                            key={notification.id}
                                            notification={notification}
                                            onClick={() => handleNotificationClick(notification)}
                                            getNotificationIcon={getNotificationIcon}
                                            getTypeLabel={getTypeLabel}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* This Month */}
                        {groupedNotifications.month.length > 0 && (
                            <div>
                                <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-2 sm:mb-3 px-1">
                                    Ce mois-ci
                                </h3>
                                <div className="space-y-2">
                                    {groupedNotifications.month.map((notification: any) => (
                                        <NotificationCard
                                            key={notification.id}
                                            notification={notification}
                                            onClick={() => handleNotificationClick(notification)}
                                            getNotificationIcon={getNotificationIcon}
                                            getTypeLabel={getTypeLabel}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Older */}
                        {groupedNotifications.older.length > 0 && (
                            <div>
                                <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-2 sm:mb-3 px-1">
                                    Plus anciennes
                                </h3>
                                <div className="space-y-2">
                                    {groupedNotifications.older.map((notification: any) => (
                                        <NotificationCard
                                            key={notification.id}
                                            notification={notification}
                                            onClick={() => handleNotificationClick(notification)}
                                            getNotificationIcon={getNotificationIcon}
                                            getTypeLabel={getTypeLabel}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Notification Card Component
function NotificationCard({
    notification,
    onClick,
    getNotificationIcon,
    getTypeLabel,
}: {
    notification: any;
    onClick: () => void;
    getNotificationIcon: (type: string) => any;
    getTypeLabel: (type: string) => string;
}) {
    const { icon: Icon, color } = getNotificationIcon(notification.type);

    return (
        <div
            className={`relative flex items-start gap-3 p-3 sm:p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${!notification.readAt
                ? 'bg-blue-50 border-blue-200'
                : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
            onClick={onClick}
        >
            {/* Unread indicator */}
            {!notification.readAt && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
            )}

            {/* Icon */}
            <div className={`flex-shrink-0 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full ${color}`}>
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 ml-2">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900 text-xs sm:text-sm truncate pr-4">
                        {notification.title}
                    </h4>
                    <Badge variant="outline" className="text-[10px] sm:text-xs flex-shrink-0">
                        {getTypeLabel(notification.type)}
                    </Badge>
                </div>

                <p className="text-[10px] sm:text-xs text-gray-600 line-clamp-2 mb-1">
                    {notification.body}
                </p>

                <p className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1">
                    {formatDistanceToNow(new Date(notification.sentAt || notification.createdAt), {
                        addSuffix: true,
                        locale: fr,
                    })}
                </p>
            </div>
        </div>
    );
}
