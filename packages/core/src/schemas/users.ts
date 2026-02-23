import { z } from "zod";

export const userRoleSchema = z.enum([
    "super_admin",
    "school_admin",
    "accountant",
    "teacher",
    "student",
    "parent",
    "supervisor",
]);

export const createUserAccountSchema = z.object({
    accessToken: z.string().min(1, "Access token is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    role: userRoleSchema,
    schoolId: z.string().uuid("Invalid school ID"),
    linkedStudentId: z.string().uuid().optional(),
    linkedParentId: z.string().uuid().optional(),
});

export type CreateUserAccountInput = z.infer<typeof createUserAccountSchema>;
