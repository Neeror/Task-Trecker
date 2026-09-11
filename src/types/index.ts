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
  .refine((v) => !/[-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(v), {
    message: 'Текст містить недопустимі символи',
  });

const TimestampSchema = z.number().int().positive();
const NonNegativeIntSchema = z.number().int().min(0);
const NonNegativeNumberSchema = z.number().finite().min(0);

/* ─────────────── Задачі ─────────────── */

export const TaskKindSchema = z.enum(['task', 'run']);
export type TaskKind = z.infer<typeof TaskKindSchema>;

/** Дистанція в метрах. 100 м .. 200 км — усе поза цим діапазоном це або описка, або баг GPS. */
export const DistanceMetersSchema = z
  .number()
  .finite()
  .min(100, 'Мінімум 100 метрів')
  .max(200_000, 'Максимум 200 кілометрів');

export const TaskSchema = z.object({
  id: IdSchema,
  title: UserTextSchema,
  date: DateStringSchema,
  done: z.boolean(),
  goalId: IdSchema.nullable(),
  kind: TaskKindSchema,
  /** Заповнене лише для kind === 'run'. */
  targetDistanceM: DistanceMetersSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const GoalPeriodSchema = z.enum(['month', 'year']);

export const GoalSchema = z.object({
  id: IdSchema,
  title: UserTextSchema,
  period: GoalPeriodSchema,
  periodKey: z.string().regex(/^\d{4}(-\d{2})?$/, 'Некоректний період'),
  targetCount: z.number().int().min(1).max(10_000),
  manualPercent: z.number().int().min(0).max(100).nullable(),
  createdAt: TimestampSchema,
});

export const DailySummarySchema = z
  .object({
    date: DateStringSchema,
    totalTasks: NonNegativeIntSchema,
    doneTasks: NonNegativeIntSchema,
    percent: z.number().int().min(0).max(100),
    closedAt: TimestampSchema,
  })
  .refine((s) => s.doneTasks <= s.totalTasks, {
    message: 'Виконаних задач не може бути більше, ніж усього',
  });

export type DateString = z.infer<typeof DateStringSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type GoalPeriod = z.infer<typeof GoalPeriodSchema>;
export type DailySummary = z.infer<typeof DailySummarySchema>;

/**
 * Вхід для створення задачі — дискримінований union.
 * Так тип 'run' фізично не може існувати без цільової дистанції,
 * а звичайна задача не може її випадково отримати.
 */
export const NewTaskInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('task'),
    title: UserTextSchema,
    date: DateStringSchema,
    goalId: IdSchema.nullable().default(null),
  }),
  z.object({
    kind: z.literal('run'),
    title: UserTextSchema,
    date: DateStringSchema,
    goalId: IdSchema.nullable().default(null),
    targetDistanceM: DistanceMetersSchema,
  }),
]);
export type NewTaskInput = z.input<typeof NewTaskInputSchema>;
export type ParsedNewTaskInput = z.infer<typeof NewTaskInputSchema>;

export const NewGoalInputSchema = z.object({
  title: UserTextSchema,
  period: GoalPeriodSchema,
  periodKey: z.string().regex(/^\d{4}(-\d{2})?$/),
  targetCount: z.number().int().min(1).max(10_000),
});
export const GoalStepSchema = z.object({
  id: IdSchema,
  goalId: IdSchema,
  title: UserTextSchema,
  done: z.boolean(),
  createdAt: TimestampSchema,
});
export type GoalStep = z.infer<typeof GoalStepSchema>;

export const NewGoalStepInputSchema = z.object({
  goalId: IdSchema,
  title: UserTextSchema,
});
export type NewGoalStepInput = z.infer<typeof NewGoalStepInputSchema>;

export type NewGoalInput = z.infer<typeof NewGoalInputSchema>;

/* ─────────────── Пробіжки ─────────────── */

export const RunStatusSchema = z.enum(['active', 'paused', 'finished']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunSchema = z
  .object({
    id: IdSchema,
    /** Пробіжка може бути «вільною», без задачі в списку дня. */
    taskId: IdSchema.nullable(),
    date: DateStringSchema,
    status: RunStatusSchema,
    startedAt: TimestampSchema,
    endedAt: TimestampSchema.nullable(),
    /** Момент постановки на паузу; null якщо не на паузі. */
    pausedAt: TimestampSchema.nullable(),
    pausedMs: NonNegativeIntSchema,
    movingMs: NonNegativeIntSchema,
    distanceM: NonNegativeNumberSchema,
    ascentM: NonNegativeNumberSchema,
    targetDistanceM: DistanceMetersSchema.nullable(),
  })
  .refine((r) => r.endedAt === null || r.endedAt >= r.startedAt, {
    message: 'Пробіжка не може завершитись раніше, ніж почалась',
  });
export type Run = z.infer<typeof RunSchema>;

export const RunPointSchema = z.object({
  runId: IdSchema,
  seq: NonNegativeIntSchema,
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  altitude: z.number().finite().nullable(),
  accuracy: NonNegativeNumberSchema.nullable(),
  speed: z.number().finite().nullable(),
  recordedAt: TimestampSchema,
});
export type RunPoint = z.infer<typeof RunPointSchema>;

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
