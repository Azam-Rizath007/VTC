import { z } from 'zod'

export const studentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  gradeId: z.string().min(1, 'Grade is required'),
  parentName: z.string().optional(),
  parentContact: z.string().optional(),
  notes: z.string().optional(),
  subjectIds: z.array(z.string()).min(1, 'Select at least one subject'),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

export type StudentFormData = z.infer<typeof studentSchema>
