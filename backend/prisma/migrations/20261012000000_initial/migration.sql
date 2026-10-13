-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "full" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "cover" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "admin" TEXT NOT NULL,
    "since" TEXT NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "alunos" INTEGER NOT NULL DEFAULT 0,
    "previstos" INTEGER NOT NULL DEFAULT 0,
    "periodos" INTEGER NOT NULL DEFAULT 0,
    "ucs" INTEGER NOT NULL DEFAULT 0,
    "aulas" INTEGER NOT NULL DEFAULT 0,
    "preco" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adesao" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "piloto" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "photo" INTEGER NOT NULL DEFAULT 0,
    "tenantId" TEXT,
    "courseId" TEXT,
    "studentId" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "progresso" INTEGER NOT NULL,
    "nota" DOUBLE PRECISION NOT NULL,
    "tempo" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL,
    "risco" TEXT NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "atividade" TEXT NOT NULL,
    "desde" INTEGER NOT NULL DEFAULT 0,
    "usoProva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flash" INTEGER NOT NULL DEFAULT 0,
    "acerto" INTEGER NOT NULL DEFAULT 0,
    "weeks" TEXT NOT NULL,
    "notas" TEXT NOT NULL,
    "tempos" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "img" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "aulas" INTEGER NOT NULL,
    "lista" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "duracao" TEXT NOT NULL DEFAULT '45 min',
    "prof" TEXT NOT NULL DEFAULT 'Prof. Dr. Sérgio Amaral',
    "pdfUrl" TEXT,
    "moduleId" TEXT NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "q" INTEGER NOT NULL,
    "feitos" INTEGER NOT NULL DEFAULT 0,
    "media" DOUBLE PRECISION,
    "tempo" INTEGER,
    "dificil" TEXT NOT NULL DEFAULT '—',
    "futura" BOOLEAN NOT NULL DEFAULT false,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" SERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL,
    "alts" TEXT NOT NULL,
    "correta" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL,
    "erro" INTEGER NOT NULL DEFAULT 0,
    "dist" TEXT NOT NULL DEFAULT '[]',
    "examId" TEXT,
    "courseId" TEXT,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" INTEGER NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_dominio_key" ON "Tenant"("dominio");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

