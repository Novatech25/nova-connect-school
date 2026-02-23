'use client';
import { useState } from "react";
import { useLicenses } from "@novaconnect/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LicenseForm } from "@/components/super-admin/LicenseForm";
import {
  Key,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  Plus,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  getLicenseStatusColor,
  getLicenseTypeColor,
  getLicenseTypeLabel,
  getDaysUntilExpiration,
} from "@/lib/license-utils";

export default function LicensesPage() {
  const router = useRouter();
  const { licenses, isLoading, revokeLicense } = useLicenses();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filter licenses
  const filteredLicenses = licenses?.filter((license) => {
    const matchesSearch =
      search === "" ||
      license.license_key.toLowerCase().includes(search.toLowerCase()) ||
      license.school?.name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || license.status === statusFilter;
    const matchesType = typeFilter === "all" || license.license_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Licenses</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage all licenses in the platform
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Generate License
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate New License</DialogTitle>
            </DialogHeader>
            <LicenseForm
              onSubmit={async (data) => {
                // TODO: Implement creation via mutation
                console.log("Generating license:", data);
                setIsCreateDialogOpen(false);
              }}
              submitLabel="Generate License"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          placeholder="Search by key or school..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>License Key</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Activations</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading licenses...
                </TableCell>
              </TableRow>
            ) : filteredLicenses && filteredLicenses.length > 0 ? (
              filteredLicenses.map((license) => (
                <TableRow key={license.id}>
                  <TableCell className="font-mono text-sm">{license.license_key}</TableCell>
                  <TableCell>{license.school?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge className={getLicenseTypeColor(license.license_type)}>
                      {getLicenseTypeLabel(license.license_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getLicenseStatusColor(license.status)}>
                      {license.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div>{format(new Date(license.expires_at), "MMM d, yyyy")}</div>
                      {license.status === "active" && (
                        <div
                          className={`text-xs ${
                            getDaysUntilExpiration(license.expires_at) <= 30
                              ? "text-red-600"
                              : "text-gray-500"
                          }`}
                        >
                          {getDaysUntilExpiration(license.expires_at)} days left
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {license.activation_count}/{license.max_activations}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/super-admin/licenses/${license.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => revokeLicense.mutate(license.id)}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No licenses found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
