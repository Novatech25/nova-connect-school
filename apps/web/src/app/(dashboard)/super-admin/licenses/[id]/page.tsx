'use client';
import { useState, use } from "react";
import { useLicense, useLicenseActivations } from "@novaconnect/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LicenseForm } from "@/components/super-admin/LicenseForm";
import {
  Key,
  Edit,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Calendar,
  Shield,
  Server,
  Eye,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getLicenseStatusColor,
  getLicenseTypeColor,
  getLicenseTypeLabel,
  getDaysUntilExpiration,
  isExpiringSoon,
  getLicenseUtilization,
} from "@/lib/license-utils";

export default function LicenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { license, isLoading: licenseLoading, updateLicense, revokeLicense, deleteLicense } = useLicense(id);
  const { activations, isLoading: activationsLoading } = useLicenseActivations(id);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (licenseLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/super-admin/licenses">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!license) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/super-admin/licenses">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">License Not Found</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              The requested license does not exist or you don't have access to it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const daysUntilExpiration = getDaysUntilExpiration(license.expires_at);
  const utilization = getLicenseUtilization(license.activation_count, license.max_activations);

  const handleRevoke = async () => {
    if (confirm("Are you sure you want to revoke this license? This action cannot be undone.")) {
      await revokeLicense.mutateAsync(license.id);
    }
  };

  const handleDelete = async () => {
    await deleteLicense.mutateAsync(license.id);
    router.push("/super-admin/licenses");
  };

  const handleExtendLicense = () => {
    // TODO: Implement extension logic
    alert("Extension functionality coming soon!");
  };

  const handleResetActivations = async () => {
    // TODO: Implement reset via Edge Function or direct mutation
    alert("Reset activations functionality coming soon!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/super-admin/licenses">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {license.license_key}
              </h1>
              <Badge className={getLicenseStatusColor(license.status)}>
                {license.status}
              </Badge>
              <Badge className={getLicenseTypeColor(license.license_type)}>
                {getLicenseTypeLabel(license.license_type)}
              </Badge>
            </div>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              School: {license.school?.name} • Created: {format(new Date(license.created_at), "PPP")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit License</DialogTitle>
              </DialogHeader>
              <LicenseForm
                defaultValues={{
                  schoolId: license.school_id,
                  licenseType: license.license_type,
                  expiresAt: new Date(license.expires_at),
                  maxActivations: license.max_activations,
                  metadata: license.metadata as Record<string, unknown>,
                }}
                onSubmit={async (data) => {
                  await updateLicense.mutateAsync({
                    id: license.id,
                    license_type: data.licenseType,
                    expires_at: data.expiresAt.toISOString(),
                    max_activations: data.maxActivations,
                    metadata: data.metadata,
                  });
                  setIsEditDialogOpen(false);
                }}
                submitLabel="Update License"
              />
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={handleExtendLicense}>
            <Calendar className="mr-2 h-4 w-4" />
            Extend
          </Button>
          <Button variant="outline" onClick={handleResetActivations}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button variant="destructive" onClick={handleRevoke}>
            <Shield className="mr-2 h-4 w-4" />
            Revoke
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {license.status === "active" && isExpiringSoon(license.expires_at) && (
        <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            This license expires in <strong>{daysUntilExpiration} days</strong> on{" "}
            {format(new Date(license.expires_at), "PPP")}. Consider extending it or notifying the school.
          </AlertDescription>
        </Alert>
      )}

      {license.status === "revoked" && (
        <Alert className="border-red-500/50 bg-red-50 dark:bg-red-900/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            This license has been revoked. All activations have been deactivated and the license is no longer valid.
          </AlertDescription>
        </Alert>
      )}

      {utilization >= 90 && license.status === "active" && (
        <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-900/20">
          <Server className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            This license has reached <strong>{utilization}%</strong> of its activation limit ({license.activation_count}/{license.max_activations}).
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activations">
            Activations ({license.activation_count}/{license.max_activations})
          </TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* License Information */}
            <Card>
              <CardHeader>
                <CardTitle>License Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">License Key</p>
                  <p className="text-sm font-mono text-gray-600 dark:text-gray-400 mt-1">
                    {license.license_key}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">License Type</p>
                  <Badge className={getLicenseTypeColor(license.license_type)}>
                    {getLicenseTypeLabel(license.license_type)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <Badge className={getLicenseStatusColor(license.status)}>
                    {license.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader>
                <CardTitle>Important Dates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Issued</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {format(new Date(license.issued_at), "PPP")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Expires</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {format(new Date(license.expires_at), "PPP")}
                  </p>
                  {license.status === "active" && (
                    <p className="text-xs text-gray-500 mt-1">
                      {daysUntilExpiration} days remaining
                    </p>
                  )}
                </div>
                {license.activated_at && (
                  <div>
                    <p className="text-sm font-medium">First Activated</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(license.activated_at), "PPP")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activation Limits */}
            <Card>
              <CardHeader>
                <CardTitle>Activation Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Current Activations</p>
                  <p className="text-2xl font-bold">
                    {license.activation_count} / {license.max_activations}
                  </p>
                  <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{utilization}% utilized</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Hardware Fingerprint</p>
                  <p className="text-sm font-mono text-gray-600 dark:text-gray-400 mt-1">
                    {license.hardware_fingerprint || "Not set"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* School Information */}
          <Card>
            <CardHeader>
              <CardTitle>School Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium">{license.school?.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Code: {license.school?.code}
                    {license.school?.city && license.school?.country && (
                      <>
                        {" • "} {license.school.city}, {license.school.country}
                      </>
                    )}
                  </p>
                </div>
                <Link href={`/super-admin/schools/${license.school_id}`}>
                  <Button variant="outline" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    View School
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activations Tab */}
        <TabsContent value="activations">
          <Card>
            <CardHeader>
              <CardTitle>Activation History</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Track all activations of this license for anti-copy protection
              </p>
            </CardHeader>
            <CardContent>
              {activationsLoading ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">Loading activations...</p>
                </div>
              ) : activations && activations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hardware Fingerprint</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Activated At</TableHead>
                      <TableHead>Deactivated At</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activations.map((activation) => (
                      <TableRow key={activation.id}>
                        <TableCell className="font-mono text-sm">
                          {activation.hardware_fingerprint}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {activation.ip_address || "-"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(activation.activated_at), "PPp")}
                        </TableCell>
                        <TableCell>
                          {activation.deactivated_at
                            ? format(new Date(activation.deactivated_at), "PPp")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={activation.status === "active" ? "default" : "secondary"}
                          >
                            {activation.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Key className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium">No activations yet</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    This license has not been activated yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata">
          <Card>
            <CardHeader>
              <CardTitle>License Metadata</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Additional information stored with this license
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(license.metadata, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Revocation Details */}
          {license.status === "revoked" && (license.metadata as any)?.revocation_reason && (
            <Card className="mt-6 border-red-500/50">
              <CardHeader>
                <CardTitle className="text-red-600">Revocation Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  <strong>Reason:</strong> {(license.metadata as any).revocation_reason || "Not specified"}
                </p>
                <p className="text-sm mt-2">
                  <strong>Revoked At:</strong>{" "}
                  {(license.metadata as any).revoked_at
                    ? format(new Date((license.metadata as any).revoked_at), "PPp")
                    : "Unknown"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <Alert className="border-red-500/50 bg-red-50 dark:bg-red-900/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            <div className="flex items-center justify-between">
              <div>
                <strong>Warning:</strong> This will permanently delete the license "{license.license_key}". This
                action cannot be undone.
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteLicense.isPending}
                >
                  {deleteLicense.isPending ? "Deleting..." : "Confirm Delete"}
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
