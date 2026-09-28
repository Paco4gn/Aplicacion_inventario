CREATE TABLE `ai_processes` (
  `id` text PRIMARY KEY NOT NULL, `name` text NOT NULL, `department` text DEFAULT '' NOT NULL,
  `owner` text DEFAULT '' NOT NULL, `description` text DEFAULT '' NOT NULL, `current_pain` text DEFAULT '' NOT NULL,
  `frequency` text DEFAULT '' NOT NULL, `monthly_volume` real DEFAULT 0 NOT NULL, `minutes_per_case` real DEFAULT 0 NOT NULL,
  `impact_score` integer DEFAULT 3 NOT NULL, `viability_score` integer DEFAULT 3 NOT NULL,
  `opportunity_status` text DEFAULT 'discovered' NOT NULL, `notes` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL, `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_processes_department_idx` ON `ai_processes` (`department`);
--> statement-breakpoint
CREATE TABLE `ai_use_cases` (
  `id` text PRIMARY KEY NOT NULL, `code` text DEFAULT '' NOT NULL, `title` text NOT NULL, `process_id` text,
  `category` text DEFAULT 'assistant' NOT NULL, `objective` text DEFAULT '' NOT NULL,
  `impact_score` integer DEFAULT 3 NOT NULL, `viability_score` integer DEFAULT 3 NOT NULL, `priority_score` real DEFAULT 9 NOT NULL,
  `status` text DEFAULT 'idea' NOT NULL, `responsible` text DEFAULT '' NOT NULL, `start_date` text, `end_date` text,
  `risk_level` text DEFAULT 'medium' NOT NULL, `data_sensitivity` text DEFAULT 'internal' NOT NULL,
  `ethics_review` integer DEFAULT false NOT NULL, `notes` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL, `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_use_cases_status_idx` ON `ai_use_cases` (`status`,`priority_score`);
--> statement-breakpoint
CREATE INDEX `ai_use_cases_process_idx` ON `ai_use_cases` (`process_id`);
--> statement-breakpoint
CREATE TABLE `ai_work_items` (
  `id` text PRIMARY KEY NOT NULL, `code` text NOT NULL, `title` text NOT NULL, `phase` text NOT NULL,
  `subtasks` text DEFAULT '' NOT NULL, `duration_days` integer DEFAULT 0 NOT NULL, `start_date` text NOT NULL, `end_date` text NOT NULL,
  `status` text DEFAULT 'planned' NOT NULL, `progress` integer DEFAULT 0 NOT NULL, `owner` text DEFAULT '' NOT NULL,
  `depends_on` text DEFAULT '' NOT NULL, `use_case_id` text, `notes` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL, `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_work_items_code_uidx` ON `ai_work_items` (`code`);
--> statement-breakpoint
CREATE INDEX `ai_work_items_dates_idx` ON `ai_work_items` (`start_date`,`end_date`);
--> statement-breakpoint
CREATE TABLE `ai_pilots` (
  `id` text PRIMARY KEY NOT NULL, `use_case_id` text, `name` text NOT NULL, `hypothesis` text DEFAULT '' NOT NULL,
  `architecture` text DEFAULT '' NOT NULL, `model_name` text DEFAULT '' NOT NULL, `tools` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'design' NOT NULL, `version` text DEFAULT '0.1' NOT NULL, `repository_url` text DEFAULT '' NOT NULL,
  `demo_url` text DEFAULT '' NOT NULL, `baseline_minutes` real DEFAULT 0 NOT NULL, `current_minutes` real DEFAULT 0 NOT NULL,
  `accuracy` real DEFAULT 0 NOT NULL, `satisfaction` real DEFAULT 0 NOT NULL, `monthly_runs` integer DEFAULT 0 NOT NULL,
  `monthly_cost` real DEFAULT 0 NOT NULL, `incidents_count` integer DEFAULT 0 NOT NULL, `last_evaluation_at` text,
  `notes` text DEFAULT '' NOT NULL, `created_at` text NOT NULL, `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_pilots_use_case_idx` ON `ai_pilots` (`use_case_id`,`status`);
--> statement-breakpoint
CREATE TABLE `ai_integrations` (
  `id` text PRIMARY KEY NOT NULL, `pilot_id` text, `system_name` text NOT NULL,
  `integration_type` text DEFAULT 'api' NOT NULL, `data_direction` text DEFAULT 'bidirectional' NOT NULL,
  `environment` text DEFAULT 'test' NOT NULL, `status` text DEFAULT 'planned' NOT NULL, `owner` text DEFAULT '' NOT NULL,
  `last_tested_at` text, `notes` text DEFAULT '' NOT NULL, `created_at` text NOT NULL, `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_integrations_pilot_idx` ON `ai_integrations` (`pilot_id`,`status`);
--> statement-breakpoint
CREATE TABLE `ai_kpis` (
  `id` text PRIMARY KEY NOT NULL, `use_case_id` text, `pilot_id` text, `name` text NOT NULL, `unit` text DEFAULT '%' NOT NULL,
  `baseline_value` real DEFAULT 0 NOT NULL, `target_value` real DEFAULT 0 NOT NULL, `current_value` real DEFAULT 0 NOT NULL,
  `measurement_date` text, `evidence_url` text DEFAULT '' NOT NULL, `notes` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL, `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_kpis_pilot_idx` ON `ai_kpis` (`pilot_id`,`measurement_date`);
--> statement-breakpoint
CREATE TABLE `ai_deliverables` (
  `id` text PRIMARY KEY NOT NULL, `code` text DEFAULT '' NOT NULL, `title` text NOT NULL, `phase` text DEFAULT '' NOT NULL,
  `deliverable_type` text DEFAULT 'document' NOT NULL, `status` text DEFAULT 'planned' NOT NULL, `due_date` text,
  `completed_at` text, `owner` text DEFAULT '' NOT NULL, `file_url` text DEFAULT '' NOT NULL, `notes` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL, `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_deliverables_due_idx` ON `ai_deliverables` (`status`,`due_date`);
--> statement-breakpoint
INSERT OR IGNORE INTO `ai_processes` VALUES
('ai-process-docs','Gestión documental','Transversal','Departamento Técnico','Localización, clasificación y consulta de documentación interna','Tiempo elevado de búsqueda y respuestas repetitivas','Diaria',120,12,5,4,'selected','Oportunidad propuesta en la memoria AI4FEVAL','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-process-service','Atención al cliente','Ferias y eventos','Por asignar','Recepción y respuesta de consultas frecuentes','Carga repetitiva y tiempos de respuesta variables','Diaria',180,8,5,4,'selected','Piloto sugerido por los resultados esperados','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-process-support','Soporte técnico','Departamento Técnico','Departamento Técnico','Clasificación y resolución inicial de incidencias TIC','Tareas manuales de clasificación, consulta y seguimiento','Diaria',80,15,4,5,'selected','Conectado con el módulo de incidencias del inventario','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `ai_use_cases` VALUES
('ai-case-docs','UC-01','Asistente documental interno','ai-process-docs','document_assistant','Responder preguntas con fuentes internas y facilitar la gestión documental',5,4,20,'idea','Departamento Técnico','2026-04-27','2026-11-06','medium','confidential',0,'Propuesta inicial: requiere inventario documental, control de acceso y evaluación de respuestas','2026-02-23T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-case-service','UC-02','Asistente de atención al cliente','ai-process-service','chatbot','Reducir tiempos de respuesta y derivar consultas complejas',5,4,20,'idea','Por asignar','2026-04-27','2026-11-06','medium','internal',0,'Propuesta inicial: validar tono, cobertura y escalado humano','2026-02-23T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-case-support','UC-03','Agente de apoyo al soporte técnico','ai-process-support','workflow_agent','Clasificar incidencias, sugerir resolución y automatizar seguimientos',4,5,20,'idea','Departamento Técnico','2026-04-27','2026-11-06','low','internal',0,'Propuesta inicial: debe mantener trazabilidad y confirmación humana','2026-02-23T09:00:00.000Z','2026-09-28T09:00:00.000Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `ai_work_items` VALUES
('ai-task-11','1.1','Toma de contacto e identificación de procesos clave','Fase 1','Reuniones iniciales y recopilación documental',10,'2026-01-12','2026-01-23','planned',0,'Departamento Técnico','','','Plan importado de la memoria; actualizar con el avance real','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-task-12','1.2','Análisis funcional y técnico','Fase 1','Mapa de procesos y flujos de información',20,'2026-01-26','2026-02-20','planned',0,'Departamento Técnico','1.1','','Plan importado de la memoria; actualizar con el avance real','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-task-21','2.1','Selección de casos de uso IA','Fase 2','Priorización por impacto y viabilidad',15,'2026-02-23','2026-03-13','planned',0,'Departamento Técnico','1.2','','Plan importado de la memoria; actualizar con el avance real','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-task-22','2.2','Diseño de pilotos','Fase 2','Prototipos conceptuales y arquitectura de agentes',25,'2026-03-16','2026-04-24','planned',0,'Departamento Técnico','2.1','','Plan importado de la memoria; actualizar con el avance real','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-task-31','3.1','Desarrollo técnico de agentes IA','Fase 3','Chatbots, RPA y asistentes documentales',60,'2026-04-27','2026-07-17','planned',0,'Departamento Técnico','2.2','','Plan importado de la memoria; actualizar con el avance real','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-task-32','3.2','Integración con sistemas internos','Fase 3','Pruebas con ERP, CRM, correo y gestión documental',40,'2026-07-20','2026-10-09','planned',0,'Departamento Técnico','3.1','','Plan importado de la memoria; actualizar con el avance real','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-task-33','3.3','Evaluación funcional y ajuste de modelos','Fase 3','Validación con usuarios e indicadores de rendimiento',20,'2026-10-12','2026-11-06','planned',0,'Departamento Técnico','3.2','','Calendario oficial de la memoria','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-task-41','4.1','Documentación metodológica','Fase 4','Guía replicable para pymes',15,'2026-11-09','2026-11-27','planned',0,'Departamento Técnico','3.3','','Calendario oficial de la memoria','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-task-42','4.2','Difusión y cierre del proyecto','Fase 4','Presentación de resultados e informes finales',20,'2026-11-30','2026-12-31','planned',0,'Departamento Técnico','4.1','','Calendario oficial de la memoria','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `ai_deliverables` VALUES
('ai-deliverable-1','R-01','Análisis de viabilidad de agentes IA','Fase 2','report','planned','2026-11-06',NULL,'Departamento Técnico','','Documento esperado por la memoria','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-deliverable-2','R-02','Prototipo funcional 1','Fase 3','prototype','planned','2026-11-06',NULL,'Departamento Técnico','','Primero de los 2-3 prototipos previstos','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-deliverable-3','R-03','Prototipo funcional 2','Fase 3','prototype','planned','2026-11-06',NULL,'Departamento Técnico','','Segundo de los 2-3 prototipos previstos','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-deliverable-4','R-04','Evaluación de eficiencia y ahorro de tiempo','Fase 3','evaluation','planned','2026-11-06',NULL,'Departamento Técnico','','Indicadores comparables con línea base','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-deliverable-5','R-05','Guía metodológica replicable para pymes','Fase 4','guide','planned','2026-11-27',NULL,'Departamento Técnico','','Manual de buenas prácticas y replicabilidad','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z'),
('ai-deliverable-6','R-06','Jornada de difusión y transferencia','Fase 4','event','planned','2026-12-31',NULL,'Departamento Técnico','','Presentación de resultados al ecosistema regional','2026-01-12T09:00:00.000Z','2026-09-28T09:00:00.000Z');
