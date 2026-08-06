import { z } from 'zod';

/**
 * Credential validation.
 *
 * Messages here are intentionally about format only. Whether an email is already
 * registered, or whether a password matched, is answered by one generic message
 * from the server so the forms cannot be used to enumerate accounts.
 */

export const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(1, { message: 'Enter your email address' })
	.max(254)
	.email({ message: 'That does not look like an email address' });

/**
 * Long minimum, no composition rules: length beats character-class requirements,
 * and rules that fight a password manager make things worse.
 */
export const passwordSchema = z
	.string()
	.min(12, { message: 'Use at least 12 characters' })
	.max(200, { message: 'Passwords are limited to 200 characters' });

export const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, { message: 'Enter your password' })
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
	.object({
		name: z.string().trim().min(1, { message: 'Enter your name' }).max(160),
		email: emailSchema,
		password: passwordSchema,
		confirmPassword: z.string()
	})
	.superRefine((value, ctx) => {
		if (value.password !== value.confirmPassword) {
			ctx.addIssue({
				code: 'custom',
				path: ['confirmPassword'],
				message: 'The two passwords do not match'
			});
		}
	});
export type RegisterInput = z.infer<typeof registerSchema>;

export const requestPasswordResetSchema = z.object({ email: emailSchema });

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, { message: 'Enter your current password' }),
		newPassword: passwordSchema,
		confirmPassword: z.string()
	})
	.superRefine((value, ctx) => {
		if (value.newPassword !== value.confirmPassword) {
			ctx.addIssue({
				code: 'custom',
				path: ['confirmPassword'],
				message: 'The two passwords do not match'
			});
		}
	});

export const updateProfileSchema = z.object({
	name: z.string().trim().min(1, { message: 'Enter your name' }).max(160)
});
