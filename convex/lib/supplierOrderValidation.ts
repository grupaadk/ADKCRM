// Wspólna walidacja zamówienia u dostawcy — używana w UI (kreator) i w akcji wysyłki do CRM.
// Plik nie może importować modułów serwerowych Convex.

export type SupplierOrderStep = "supplier" | "products" | "attachments" | "summary";

export type SupplierOrderIssue = {
  step: SupplierOrderStep;
  message: string;
};

export type SupplierOrderValidationInput = {
  netAmount?: number;
  selectedProducts?: Array<{
    id: string;
    name: string;
    answers?: Array<{
      questionId: string;
      question: string;
      answer: string;
    }>;
  }>;
  supplierProducts?: Array<{
    id: string;
    name: string;
    isActive: boolean;
    questions?: Array<{
      id: string;
      question: string;
    }>;
  }>;
};

export function getSupplierOrderIssues(input: SupplierOrderValidationInput): SupplierOrderIssue[] {
  const issues: SupplierOrderIssue[] = [];

  if (!input.netAmount || input.netAmount <= 0) {
    issues.push({ step: "supplier", message: "Uzupełnij kwotę netto (musi być większa od 0)" });
  }

  const supplierProducts = input.supplierProducts ?? [];
  const selectedProducts = input.selectedProducts ?? [];
  const hasActiveProducts = supplierProducts.some((p) => p.isActive);

  if (hasActiveProducts && selectedProducts.length === 0) {
    issues.push({ step: "products", message: "Wybierz co najmniej jeden produkt" });
  }

  for (const selected of selectedProducts) {
    const definition = supplierProducts.find((p) => p.id === selected.id);
    const questions = definition?.questions ?? [];
    const answers = selected.answers ?? [];
    for (const q of questions) {
      const answer =
        answers.find((a) => a.questionId === q.id) ??
        answers.find(
          (a) =>
            !questions.some((other) => other.id === a.questionId) &&
            a.question === q.question,
        );
      if (!answer || answer.answer.trim().length === 0) {
        issues.push({
          step: "products",
          message: `${selected.name}: brak odpowiedzi na „${q.question}”`,
        });
      }
    }
  }

  return issues;
}
