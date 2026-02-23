"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getModerationRules, createModerationRule } from "@novaconnect/data";
import type { CreateModerationRule } from "@novaconnect/core";
import { useAuthContext } from "@novaconnect/data";

export default function ChatRulesPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    ruleType: 'forbidden_word',
    ruleValue: '',
    action: 'flag',
  });
  const { profile } = useAuthContext();
  const schoolId = profile?.schoolId;

  const { data: rules, isLoading } = useQuery({
    queryKey: ['chat-moderation-rules', schoolId],
    queryFn: async () => {
      const { getModerationRules } = await import("@novaconnect/data");
      return getModerationRules(schoolId!);
    },
    enabled: !!schoolId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateModerationRule) => {
      const { createModerationRule } = await import("@novaconnect/data");
      return createModerationRule(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-moderation-rules', schoolId] });
      setIsOpen(false);
      setFormData({ ruleType: 'forbidden_word', ruleValue: '', action: 'flag' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ruleValue.trim()) return;

    createMutation.mutate({
      schoolId: schoolId!,
      ...formData,
    });
  };

  const getRuleTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'forbidden_word': return 'bg-red-100 text-red-800';
      case 'regex_pattern': return 'bg-purple-100 text-purple-800';
      case 'max_message_length': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'flag': return 'bg-yellow-100 text-yellow-800';
      case 'block': return 'bg-red-100 text-red-800';
      case 'require_approval': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Chat Moderation Rules</h1>
          <p className="text-muted-foreground mt-2">
            Configure automatic content filtering and moderation rules
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Moderation Rule</DialogTitle>
              <DialogDescription>
                Add a new rule for automatic content moderation
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ruleType">Rule Type</Label>
                  <Select
                    value={formData.ruleType}
                    onValueChange={(value: any) => setFormData({ ...formData, ruleType: value })}
                  >
                    <SelectTrigger id="ruleType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="forbidden_word">Forbidden Word</SelectItem>
                      <SelectItem value="regex_pattern">Regex Pattern</SelectItem>
                      <SelectItem value="max_message_length">Max Message Length</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ruleValue">Rule Value</Label>
                  <Input
                    id="ruleValue"
                    placeholder={formData.ruleType === 'max_message_length' ? '5000' : 'Enter value'}
                    value={formData.ruleValue}
                    onChange={(e) => setFormData({ ...formData, ruleValue: e.target.value })}
                    type={formData.ruleType === 'max_message_length' ? 'number' : 'text'}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.ruleType === 'forbidden_word' && 'Enter a word that will trigger moderation'}
                    {formData.ruleType === 'regex_pattern' && 'Enter a regex pattern to match content'}
                    {formData.ruleType === 'max_message_length' && 'Maximum allowed message length in characters'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action">Action</Label>
                  <Select
                    value={formData.action}
                    onValueChange={(value: any) => setFormData({ ...formData, action: value })}
                  >
                    <SelectTrigger id="action">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flag">Flag for Review</SelectItem>
                      <SelectItem value="block">Block Message</SelectItem>
                      <SelectItem value="require_approval">Require Approval</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Rule'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Rules</CardTitle>
          <CardDescription>Currently enabled moderation rules for your school</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-sm font-medium">Type</th>
                  <th className="p-3 text-left text-sm font-medium">Value</th>
                  <th className="p-3 text-left text-sm font-medium">Action</th>
                  <th className="p-3 text-left text-sm font-medium">Status</th>
                  <th className="p-3 text-left text-sm font-medium">Created At</th>
                </tr>
              </thead>
              <tbody>
                {rules && rules.length > 0 ? (
                  rules.map((rule: any) => (
                    <tr key={rule.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <Badge className={getRuleTypeBadgeColor(rule.rule_type)}>
                          {rule.rule_type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm font-mono">
                        {rule.rule_value}
                      </td>
                      <td className="p-3">
                        <Badge className={getActionBadgeColor(rule.action)}>
                          {rule.action}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={rule.is_active ? "default" : "secondary"}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm">
                        {new Date(rule.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No moderation rules configured yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
