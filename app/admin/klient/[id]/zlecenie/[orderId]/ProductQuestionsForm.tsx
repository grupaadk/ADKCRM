"use client";

export type SupplierProductDefinition = {
  id: string;
  name: string;
  isActive: boolean;
  questions?: Array<{
    id: string;
    question: string;
  }>;
};

export type SelectedProductEntry = {
  id: string;
  name: string;
  answers?: Array<{
    questionId: string;
    question: string;
    answer: string;
  }>;
};

type ProductQuestionsFormProps = Readonly<{
  supplierProducts: SupplierProductDefinition[];
  selectedProducts: SelectedProductEntry[];
  onChange: (nextSelectedProducts: SelectedProductEntry[]) => void;
  compact?: boolean;
  showValidation?: boolean;
  readOnly?: boolean;
}>;

export default function ProductQuestionsForm({
  supplierProducts,
  selectedProducts,
  onChange,
  compact = false,
  showValidation = false,
  readOnly = false,
}: ProductQuestionsFormProps) {
  const activeSupplierProducts = supplierProducts.filter((p) => p.isActive);
  const activeIds = new Set(activeSupplierProducts.map((p) => p.id));
  const legacySelected = selectedProducts.filter((p) => !activeIds.has(p.id));
  const allOptions = [
    ...activeSupplierProducts.map((p) => ({
      id: p.id,
      name: p.name,
      isArchived: false,
      questions: p.questions ?? [],
    })),
    ...legacySelected.map((p) => {
      const def = supplierProducts.find((sp) => sp.id === p.id);
      return {
        id: p.id,
        name: p.name,
        isArchived: true,
        questions: def?.questions ?? [],
      };
    }),
  ];

  function toggleProduct(prod: {
    id: string;
    name: string;
    questions: Array<{ id: string; question: string }>;
  }) {
    if (readOnly) return;
    const exists = selectedProducts.some((item) => item.id === prod.id);
    const next = exists
      ? selectedProducts.filter((item) => item.id !== prod.id)
      : [
          ...selectedProducts,
          {
            id: prod.id,
            name: prod.name,
            answers: prod.questions.map((q) => ({
              questionId: q.id,
              question: q.question,
              answer: "",
            })),
          },
        ];
    onChange(next);
  }

  function updateProductQuestionAnswer(
    productId: string,
    productName: string,
    questionId: string,
    answerText: string,
    supplierQuestions: Array<{ id: string; question: string }>,
  ) {
    if (readOnly) return;
    const next = selectedProducts.map((item) => {
      if (item.id !== productId) return item;
      const existingAnswers = item.answers ?? [];
      const mergedQuestionIds = new Set([
        ...supplierQuestions.map((q) => q.id),
        ...existingAnswers.map((a) => a.questionId),
      ]);
      const updatedAnswers: Array<{
        questionId: string;
        question: string;
        answer: string;
      }> = [];
      for (const qId of mergedQuestionIds) {
        const supQ = supplierQuestions.find((q) => q.id === qId);
        const exA = existingAnswers.find((a) => a.questionId === qId);
        const qLabel = supQ?.question ?? exA?.question ?? "";
        if (!qLabel) continue;
        updatedAnswers.push({
          questionId: qId,
          question: qLabel,
          answer: qId === questionId ? answerText : (exA?.answer ?? ""),
        });
      }
      return {
        ...item,
        name: productName,
        answers: updatedAnswers,
      };
    });
    onChange(next);
  }

  const selectedProductsWithQuestions = selectedProducts
    .map((sel) => {
      const supProd = supplierProducts.find((p) => p.id === sel.id);
      const supQuestions = supProd?.questions ?? [];
      const existingAnswers = sel.answers ?? [];
      const questionsList: Array<{
        questionId: string;
        question: string;
        answer: string;
      }> = [];
      const seenQIds = new Set<string>();
      for (const sq of supQuestions) {
        seenQIds.add(sq.id);
        const foundAns =
          existingAnswers.find((a) => a.questionId === sq.id) ??
          existingAnswers.find(
            (a) =>
              !supQuestions.some((other) => other.id === a.questionId) &&
              a.question === sq.question,
          );
        questionsList.push({
          questionId: sq.id,
          question: sq.question,
          answer: foundAns?.answer ?? "",
        });
      }
      for (const ea of existingAnswers) {
        if (!seenQIds.has(ea.questionId)) {
          questionsList.push(ea);
        }
      }
      return {
        id: sel.id,
        name: sel.name,
        supplierQuestions: supQuestions,
        questionsList,
      };
    })
    .filter((p) => p.questionsList.length > 0);

  const hasActiveProducts = activeSupplierProducts.length > 0;
  const missingProductSelection = showValidation && hasActiveProducts && selectedProducts.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Produkty u dostawcy i pytania do zamówienia
          </span>
          {selectedProducts.length > 0 && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Wybrano: {selectedProducts.length}
            </span>
          )}
        </div>
        {!compact && selectedProductsWithQuestions.length > 0 && (
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50/80 border border-amber-200/80 px-2.5 py-0.5 rounded-full">
            📋 Odpowiedzi są automatycznie dołączane do wiadomości
          </span>
        )}
      </div>

      {allOptions.length === 0 ? (
        <p className="text-xs text-slate-400 bg-slate-50/60 border border-dashed border-slate-200 rounded-lg px-3 py-2">
          Ten dostawca nie ma przypisanych produktów. Możesz je dodać w Ustawienia → Dostawcy.
        </p>
      ) : (
        <div
          className={`flex flex-wrap gap-1.5 p-2.5 rounded-xl border ${
            missingProductSelection
              ? "border-red-300 bg-red-50/40"
              : "border-slate-200 bg-slate-50/40"
          }`}
        >
          {allOptions.map((prod) => {
            const checked = selectedProducts.some((s) => s.id === prod.id);
            return (
              <button
                key={prod.id}
                type="button"
                disabled={readOnly}
                onClick={() =>
                  toggleProduct({
                    id: prod.id,
                    name: prod.name,
                    questions: prod.questions,
                  })
                }
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  readOnly ? "cursor-default opacity-80" : "cursor-pointer"
                } ${
                  checked
                    ? "border-amber-500 bg-amber-50 text-amber-900 shadow-2xs"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] font-bold ${
                    checked
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "border-slate-300 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span>{prod.name}</span>
                {prod.questions.length > 0 && (
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                      checked
                        ? "bg-amber-200/80 text-amber-900"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {prod.questions.length} pyt.
                  </span>
                )}
                {prod.isArchived && (
                  <span className="text-[9px] font-medium text-slate-400">(nieaktywny)</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {missingProductSelection && (
        <p className="text-xs font-semibold text-red-600 m-0">
          Wybierz co najmniej jeden produkt z listy powyżej.
        </p>
      )}

      {selectedProductsWithQuestions.length > 0 && (
        <div className="flex flex-col gap-3">
          {selectedProductsWithQuestions.map((prodItem) => (
            <div
              key={prodItem.id}
              className="flex flex-col gap-2.5 rounded-xl border border-amber-200/90 bg-amber-50/35 p-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-amber-200/60 pb-1.5">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <span>📋</span>
                  <span>Pytania: {prodItem.name}</span>
                </span>
                <span className="text-[11px] font-medium text-amber-800">
                  {prodItem.questionsList.filter((q) => q.answer.trim().length > 0).length} /{" "}
                  {prodItem.questionsList.length}
                </span>
              </div>
              <div className={`grid gap-2.5 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
                {prodItem.questionsList.map((qItem, qIdx) => {
                  const isMissingAnswer = showValidation && qItem.answer.trim().length === 0;
                  return (
                    <div key={qItem.questionId} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-800">
                        {qIdx + 1}. {qItem.question}
                      </label>
                      <input
                        type="text"
                        readOnly={readOnly}
                        value={qItem.answer}
                        onChange={(e) =>
                          updateProductQuestionAnswer(
                            prodItem.id,
                            prodItem.name,
                            qItem.questionId,
                            e.target.value,
                            prodItem.supplierQuestions,
                          )
                        }
                        placeholder="Wpisz odpowiedź..."
                        className={`w-full rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 shadow-2xs ${
                          isMissingAnswer
                            ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                            : "border-slate-300 focus:border-amber-500 focus:ring-amber-500/20"
                        } ${readOnly ? "bg-slate-50 text-slate-600" : ""}`}
                      />
                      {isMissingAnswer && (
                        <span className="text-[11px] font-medium text-red-600">
                          Uzupełnij odpowiedź
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
