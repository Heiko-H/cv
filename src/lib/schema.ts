import { z } from 'zod';

const nonEmpty = z.string().trim().min(1);

export const SkillSchema = z.strictObject({
  category: nonEmpty,
  items: z.array(nonEmpty).min(1).max(5, 'A skill category may contain at most 5 items'),
});

export const CertificationSchema = z.strictObject({
  name: nonEmpty,
  issuer: nonEmpty,
  date: nonEmpty,
  url: z.url().optional(),
});

export const PositionSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/, 'Position ids must be lowercase kebab-case').optional(),
  title: nonEmpty,
  period: nonEmpty.optional(),
  bullets: z.array(nonEmpty).default([]),
});

export const JobSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/, 'Job ids must be lowercase kebab-case'),
  company: nonEmpty,
  title: nonEmpty,
  location: nonEmpty,
  start: nonEmpty,
  end: nonEmpty,
  bullets: z.array(nonEmpty).default([]),
  positions: z.array(PositionSchema).optional(),
  hidden: z.boolean().default(false),
});

export const EducationSchema = z.strictObject({
  school: nonEmpty,
  location: nonEmpty,
  date: nonEmpty,
  degree: nonEmpty,
  details: nonEmpty.optional(),
});

export const LanguageSchema = z.strictObject({
  name: nonEmpty,
  level: nonEmpty,
});

export const LinkSchema = z.strictObject({
  label: nonEmpty,
  url: z.url(),
});

export const CvSchema = z.strictObject({
  name: nonEmpty,
  headline: nonEmpty,
  summary: nonEmpty,
  links: z.array(LinkSchema).default([]),
  skills: z.array(SkillSchema).min(1).max(6, 'A CV may contain at most 6 skill categories'),
  certifications: z.array(CertificationSchema).max(3, 'A CV may contain at most 3 certifications').default([]),
  education: z.array(EducationSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
  work: z.array(JobSchema).min(1),
  seo: z.strictObject({ index: z.boolean().default(false) }).default({ index: false }),
});

export type Cv = z.infer<typeof CvSchema>;
export type Job = z.infer<typeof JobSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Language = z.infer<typeof LanguageSchema>;
