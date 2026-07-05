import { z } from 'zod';

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата має бути у форматі YYYY-MM-DD')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    if (y === undefined || m === undefined || d === undefined) return false;
    const date = new Date(Date.UTC(y, m - 1, d));
    return (
      date.getUTCFullYear() === y &&
      date.getUTCMonth() === m - 1 &&
      date.getUTCDate() === d
    );
  }, 'Такої дати не існує');

export const IdSchema = z.string().uuid('Некоректний ідентифікатор');

export const UserTextSchema = z
  .string()
  .trim()
  .min(1, 'Текст не може бути порожнім')
  .max(200, 'Максимум 200 символів')
  .refine((v) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(v), {
    message: 'Текст містить недопустимі символи',
  });

export const TaskSchema = z.object({
  id: IdSchema,
  title: UserTextSchema,
  date: DateStringSchema,
  done: z.boolean(),
  goalId: IdSchema.nullable(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export const GoalPeriodSchema = z.enum(['month', 'year']);


export const GoalSchema = z.object({
  id: IdSchema,
  title: UserTextSchema,
  period: GoalPeriodSchema,
  periodKey: z.string().regex(/^\d{4}(-\d{2})?$/, 'Некоректний період'),
  targetCount: z.number().int().min(1).max(10_000),
  manualPercent: z.number().int().min(0).max(100).nullable(),
  createdAt: z.number().int().positive(),
});

export const GoalStepSchema = z.object({
  id: IdSchema,
  goalId: IdSchema,
  title: UserTextSchema,
  done: z.boolean(),
  createdAt: z.number().int().positive(),
});

export const DailySummarySchema = z
  .object({
    date: DateStringSchema,
    totalTasks: z.number().int().min(0),
    doneTasks: z.number().int().min(0),
    percent: z.number().int().min(0).max(100),
    closedAt: z.number().int().positive(),
  })
  .refine((s) => s.doneTasks <= s.totalTasks, {
    message: 'Виконаних задач не може бути більше, ніж усього',
  });

export type DateString = z.infer<typeof DateStringSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type GoalPeriod = z.infer<typeof GoalPeriodSchema>;
export type GoalStep = z.infer<typeof GoalStepSchema>;
export type DailySummary = z.infer<typeof DailySummarySchema>;

export const NewTaskInputSchema = z.object({
  title: UserTextSchema,
  date: DateStringSchema,
  goalId: IdSchema.nullable().default(null),
});
export type NewTaskInput = z.infer<typeof NewTaskInputSchema>;

export const NewGoalInputSchema = z.object({
  title: UserTextSchema,
  period: GoalPeriodSchema,
  periodKey: z.string().regex(/^\d{4}(-\d{2})?$/),
  targetCount: z.number().int().min(1).max(10_000),
});
export type NewGoalInput = z.infer<typeof NewGoalInputSchema>;

export const NewGoalStepInputSchema = z.object({
  goalId: IdSchema,
  title: UserTextSchema,
});
export type NewGoalStepInput = z.infer<typeof NewGoalStepInputSchema>;


export function safeParse<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    if (__DEV__) {
      console.warn('[types] Невалідний запис відкинуто:', result.error.issues);
    }
    return null;
  }
  return result.data;
}
