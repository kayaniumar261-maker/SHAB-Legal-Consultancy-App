import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileSearch,
  FileText,
  Gavel,
  LoaderCircle,
  Mail,
  MessageSquareText,
  Scale,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type {
  CaseWithRelations,
} from '../../types/case';

import type {
  AIMessage,
  AIQuickAction,
} from '../../types/ai';

import {
  getAIContextSourceCounts,
  loadAIMatterContext,
  type AIMatterContext,
} from '../../services/aiContextService';

import {
  buildMatterPrompt,
} from '../../services/aiPromptBuilder';

import {
  requestAIResponse,
} from '../../services/aiService';

import './AIWorkspace.css';

type AIWorkspaceProps = {
  caseRecord: CaseWithRelations;
  clientName: string;
};

const quickActions: AIQuickAction[] = [
  {
    id: 'summary',
    label: 'Summarize Matter',
    description:
      'Generate a structured legal matter summary.',
    prompt:
      'Prepare a structured summary of this matter, including the parties, background, legal issues, financial position, procedural status, risks, deadlines, and recommended next actions.',
  },
  {
    id: 'notice',
    label: 'Draft Legal Notice',
    description:
      'Prepare a formal demand or legal notice.',
    prompt:
      'Draft a professional legal notice based on this matter. Include the factual background, breaches, demands, response deadline, reservation of rights, and legal consequences.',
  },
  {
    id: 'reply',
    label: 'Draft Reply',
    description:
      'Prepare a formal response to the opposing party.',
    prompt:
      'Draft a formal legal reply on behalf of our client based on the current matter information. Use a firm but professional tone and avoid unsupported admissions.',
  },
  {
    id: 'email',
    label: 'Draft Client Email',
    description:
      'Create a clear client update email.',
    prompt:
      'Draft a professional email updating the client about the current status, recent developments, pending requirements, financial position, and next steps.',
  },
  {
    id: 'settlement',
    label: 'Settlement Outline',
    description:
      'Prepare proposed settlement terms.',
    prompt:
      'Prepare a settlement proposal outline for this matter, including payment terms, releases, confidentiality, withdrawal of complaints, no-admission wording, default consequences, and governing law.',
  },
  {
    id: 'memo',
    label: 'Court Memo',
    description:
      'Create an internal court preparation memo.',
    prompt:
      'Prepare an internal court hearing memo covering the facts, claims, defences, evidence, weaknesses, strengths, procedural history, hearing objectives, and oral submissions.',
  },
  {
    id: 'timeline',
    label: 'Build Timeline',
    description:
      'Organize the matter chronologically.',
    prompt:
      'Prepare a chronological timeline of all important events, filings, hearings, communications, payments, documents, and deadlines in this matter.',
  },
  {
    id: 'risks',
    label: 'Risk Review',
    description:
      'Identify legal and operational concerns.',
    prompt:
      'Review this matter for legal, procedural, evidentiary, financial, limitation, and operational risks. Rank each risk and recommend mitigation steps.',
  },
  {
    id: 'documents',
    label: 'Missing Documents',
    description:
      'Identify evidence and documents still required.',
    prompt:
      'Identify potentially missing documents, evidence, approvals, identification documents, payment records, agreements, correspondence, and court records required for this matter.',
  },
];

export function AIWorkspace({
  caseRecord,
  clientName,
}: AIWorkspaceProps) {
  const [messages, setMessages] =
    useState<AIMessage[]>([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          `I am ready to assist with ${getMatterReference(
            caseRecord,
          )} for ${clientName}. Select a legal action or ask a question about this matter.`,
        createdAt:
          new Date().toISOString(),
      },
    ]);

  const draftStorageKey =
    `shab-ai-draft-${caseRecord.id}`;

  const [input, setInput] =
    useState(() => {
      try {
        return (
          window.localStorage.getItem(
            draftStorageKey,
          ) ?? ''
        );
      } catch {
        return '';
      }
    });

  const [loading, setLoading] =
    useState(false);

  const [
    matterContext,
    setMatterContext,
  ] = useState<AIMatterContext | null>(
    null,
  );

  const [
    contextLoading,
    setContextLoading,
  ] = useState(true);

  const [
    contextWarning,
    setContextWarning,
  ] = useState<string | null>(
    null,
  );

  const [showActions, setShowActions] =
    useState(true);

  const [showContext, setShowContext] =
    useState(true);

  const messageCounter =
    useRef(1);

  useEffect(() => {
    try {
      const savedDraft =
        window.localStorage.getItem(
          draftStorageKey,
        );

      setInput(savedDraft ?? '');
    } catch {
      setInput('');
    }
  }, [draftStorageKey]);

  useEffect(() => {
    try {
      if (input.trim()) {
        window.localStorage.setItem(
          draftStorageKey,
          input,
        );
      } else {
        window.localStorage.removeItem(
          draftStorageKey,
        );
      }
    } catch {
      // Draft persistence is a convenience only.
    }
  }, [
    draftStorageKey,
    input,
  ]);

  function clearSavedDraft() {
    try {
      window.localStorage.removeItem(
        draftStorageKey,
      );
    } catch {
      // Nothing to clear.
    }
  }

  useEffect(() => {
    let active = true;

    async function loadContext() {
      try {
        setContextLoading(true);
        setContextWarning(null);

        const context =
          await loadAIMatterContext(
            caseRecord,
            clientName,
          );

        if (!active) {
          return;
        }

        setMatterContext(context);

        if (context.errors.length > 0) {
          setContextWarning(
            `${context.errors.length} context source${
              context.errors.length === 1
                ? ''
                : 's'
            } could not be loaded.`,
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setContextWarning(
          error instanceof Error
            ? error.message
            : 'Unable to load matter context.',
        );
      } finally {
        if (active) {
          setContextLoading(false);
        }
      }
    }

    void loadContext();

    return () => {
      active = false;
    };
  }, [
    caseRecord,
    clientName,
  ]);

  const contextItems = useMemo(
    () => [
      {
        label: 'Matter',
        value:
          getMatterReference(
            caseRecord,
          ),
      },
      {
        label: 'Client',
        value: clientName,
      },
      {
        label: 'Case Type',
        value:
          caseRecord.case_type ??
          'Not specified',
      },
      {
        label: 'Status',
        value: formatLabel(
          caseRecord.status,
        ),
      },
      {
        label: 'Priority',
        value: formatLabel(
          caseRecord.priority,
        ),
      },
      {
        label: 'Court',
        value:
          caseRecord.court ??
          'Not specified',
      },
      {
        label: 'Opponent',
        value:
          caseRecord.opponent_name ??
          'Not specified',
      },
      {
        label: 'Outstanding',
        value: formatCurrency(
          caseRecord.outstanding_balance,
          caseRecord.currency,
        ),
      },
    ],
    [
      caseRecord,
      clientName,
    ],
  );

  const contextSourceCounts =
    useMemo(
      () =>
        matterContext
          ? getAIContextSourceCounts(
              matterContext,
            )
          : null,
      [matterContext],
    );

  function submitPrompt(
    promptValue?: string,
  ) {
    const prompt =
      (
        promptValue ??
        input
      ).trim();

    if (!prompt || loading) {
      return;
    }

    const userMessage: AIMessage = {
      id:
        `user-${messageCounter.current++}`,
      role: 'user',
      content: prompt,
      createdAt:
        new Date().toISOString(),
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setInput('');
    clearSavedDraft();
    setLoading(true);

    void (async () => {
      try {
        if (!matterContext) {
          throw new Error(
            'Matter context is still loading. Please try again.',
          );
        }

        const structuredPrompt =
          buildMatterPrompt(
            matterContext,
            prompt,
          );

        const response =
          await requestAIResponse({
            prompt: structuredPrompt,
            matterId: caseRecord.id,
            action:
              promptValue
                ? 'quick_action'
                : 'custom',
          });

        const assistantMessage:
          AIMessage = {
            id:
              `assistant-${messageCounter.current++}`,
            role: 'assistant',
            content: response.text,
            createdAt:
              new Date().toISOString(),
          };

        setMessages((current) => [
          ...current,
          assistantMessage,
        ]);
      } catch (error) {
        const assistantMessage:
          AIMessage = {
            id:
              `assistant-error-${messageCounter.current++}`,
            role: 'assistant',
            content:
              error instanceof Error
                ? `AI request failed: ${error.message}`
                : 'AI request failed unexpectedly.',
            createdAt:
              new Date().toISOString(),
          };

        setMessages((current) => [
          ...current,
          assistantMessage,
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }

  function clearConversation() {
    setMessages([
      {
        id:
          `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          `Conversation cleared. I am ready to assist with ${getMatterReference(
            caseRecord,
          )}.`,
        createdAt:
          new Date().toISOString(),
      },
    ]);
  }

  return (
    <div className="ai-workspace">
      <section className="ai-workspace-hero">
        <div className="ai-workspace-identity">
          <div className="ai-workspace-logo">
            <BrainCircuit
              size={25}
            />
          </div>

          <div>
            <span>
              SHAB Intelligence
            </span>

            <h3>
              AI Legal Assistant
            </h3>

            <p>
              Draft, review, summarize and analyze the current legal matter.
            </p>
          </div>
        </div>

        <div className="ai-workspace-status">
          <Sparkles size={15} />

          <span>
            Secure AI
          </span>
        </div>
      </section>

      <section className="ai-context-panel">
        <button
          type="button"
          className="ai-collapsible-heading"
          onClick={() =>
            setShowContext(
              (current) =>
                !current,
            )
          }
        >
          <div>
            <FileSearch
              size={17}
            />

            <span>
              Matter Context
            </span>
          </div>

          {showContext ? (
            <ChevronUp
              size={17}
            />
          ) : (
            <ChevronDown
              size={17}
            />
          )}
        </button>

        {showContext ? (
          <div className="ai-context-grid">
            {contextItems.map(
              (item) => (
                <ContextItem
                  key={
                    item.label
                  }
                  label={
                    item.label
                  }
                  value={
                    item.value
                  }
                />
              ),
            )}
          </div>
        ) : null}

        {showContext ? (
          <div className="ai-context-sources">
            <div className="ai-context-sources-heading">
              <span>
                Context Sources
              </span>

              <strong>
                {contextLoading
                  ? 'Loading…'
                  : contextWarning
                    ? contextWarning
                    : 'Ready'}
              </strong>
            </div>

            {contextSourceCounts ? (
              <div className="ai-context-source-grid">
                {Object.entries(
                  contextSourceCounts,
                ).map(
                  ([source, count]) => (
                    <span key={source}>
                      <strong>
                        {count}
                      </strong>

                      {formatLabel(
                        source,
                      )}
                    </span>
                  ),
                )}
              </div>
            ) : (
              <div className="ai-context-source-state">
                {contextLoading
                  ? 'Retrieving matter records…'
                  : 'Basic case information is available.'}
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="ai-quick-actions-panel">
        <button
          type="button"
          className="ai-collapsible-heading"
          onClick={() =>
            setShowActions(
              (current) =>
                !current,
            )
          }
        >
          <div>
            <Sparkles
              size={17}
            />

            <span>
              Legal Quick Actions
            </span>
          </div>

          {showActions ? (
            <ChevronUp
              size={17}
            />
          ) : (
            <ChevronDown
              size={17}
            />
          )}
        </button>

        {showActions ? (
          <div className="ai-quick-actions-grid">
            {quickActions.map(
              (action) => (
                <button
                  key={
                    action.id
                  }
                  type="button"
                  onClick={() =>
                    submitPrompt(
                      action.prompt,
                    )
                  }
                  disabled={
                    loading
                  }
                >
                  <span>
                    {getActionIcon(
                      action.id,
                    )}
                  </span>

                  <div>
                    <strong>
                      {action.label}
                    </strong>

                    <small>
                      {action.description}
                    </small>
                  </div>
                </button>
              ),
            )}
          </div>
        ) : null}
      </section>

      <section className="ai-conversation-panel">
        <header className="ai-conversation-header">
          <div>
            <MessageSquareText
              size={18}
            />

            <div>
              <h3>
                Matter Conversation
              </h3>

              <p>
                Current-session history
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={
              clearConversation
            }
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <Trash2
              size={16}
            />
          </button>
        </header>

        <div className="ai-message-list">
          {messages.map(
            (message) => (
              <AIMessageBubble
                key={message.id}
                message={
                  message
                }
              />
            ),
          )}

          {loading ? (
            <div className="ai-message assistant">
              <div className="ai-message-avatar">
                <Bot size={16} />
              </div>

              <div className="ai-message-bubble ai-loading-message">
                <LoaderCircle
                  size={16}
                />

                <span>
                  Preparing legal response…
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="ai-suggested-prompts">
          {[
            'What should we do next?',
            'What are the main risks?',
            'Prepare a client update.',
          ].map(
            (suggestion) => (
              <button
                key={
                  suggestion
                }
                type="button"
                onClick={() =>
                  submitPrompt(
                    suggestion,
                  )
                }
                disabled={
                  loading
                }
              >
                {suggestion}
              </button>
            ),
          )}
        </div>

        <form
          className="ai-composer"
          onSubmit={(
            event,
          ) => {
            event.preventDefault();
            submitPrompt();
          }}
        >
          <textarea
            value={input}
            onChange={(
              event,
            ) =>
              setInput(
                event.target
                  .value,
              )
            }
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                  'Enter' &&
                !event.shiftKey
              ) {
                event.preventDefault();
                submitPrompt();
              }
            }}
            placeholder="Ask about this matter, request a draft, or analyze a legal issue…"
            rows={3}
          />

          <div className="ai-composer-footer">
            <span>
              {input.trim()
                ? 'Draft saved on this device · Press Enter to send'
                : 'Press Enter to send · Shift + Enter for a new line'}
            </span>

            <button
              type="submit"
              disabled={
                loading ||
                !input.trim()
              }
            >
              {loading ? (
                <LoaderCircle
                  size={16}
                />
              ) : (
                <Send
                  size={16}
                />
              )}

              Send
            </button>
          </div>
        </form>
      </section>

      <section className="ai-preview-warning">
        <AlertTriangle
          size={17}
        />

        <div>
          <strong>
            Confidential AI processing
          </strong>

          <span>
            Matter context is sent securely through the authenticated SHAB Edge Function. Review every generated draft before use or filing.
          </span>
        </div>
      </section>
    </div>
  );
}

function AIMessageBubble({
  message,
}: {
  message: AIMessage;
}) {
  return (
    <div
      className={`ai-message ${message.role}`}
    >
      <div className="ai-message-avatar">
        {message.role ===
        'assistant' ? (
          <Bot size={16} />
        ) : (
          <Scale size={16} />
        )}
      </div>

      <div>
        <div className="ai-message-bubble">
          {message.content
            .split('\n')
            .map(
              (
                line,
                index,
              ) => (
                <p
                  key={
                    `${message.id}-${index}`
                  }
                >
                  {line ||
                    '\u00A0'}
                </p>
              ),
            )}
        </div>

        <time>
          {formatTime(
            message.createdAt,
          )}
        </time>
      </div>
    </div>
  );
}

function ContextItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="ai-context-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getActionIcon(
  actionId: string,
): ReactNode {
  switch (actionId) {
    case 'summary':
      return (
        <ClipboardList
          size={18}
        />
      );

    case 'notice':
      return (
        <FileText
          size={18}
        />
      );

    case 'reply':
      return (
        <MessageSquareText
          size={18}
        />
      );

    case 'email':
      return (
        <Mail size={18} />
      );

    case 'settlement':
      return (
        <Scale size={18} />
      );

    case 'memo':
      return (
        <Gavel size={18} />
      );

    case 'timeline':
      return (
        <ClipboardList
          size={18}
        />
      );

    case 'risks':
      return (
        <ShieldAlert
          size={18}
        />
      );

    default:
      return (
        <FileSearch
          size={18}
        />
      );
  }
}

function buildPreviewResponse(
  prompt: string,
  caseRecord:
    CaseWithRelations,
  clientName: string,
  matterContext:
    AIMatterContext | null,
): string {
  const normalized =
    prompt.toLowerCase();

  const structuredPrompt =
    matterContext
      ? buildMatterPrompt(
          matterContext,
          prompt,
        )
      : null;

  const sourceSummary =
    matterContext
      ? [
          `${matterContext.tasks.length} tasks`,
          `${matterContext.hearings.length} hearings`,
          `${matterContext.documents.length} documents`,
          `${matterContext.notes.length} notes`,
          `${matterContext.activities.length} activities`,
          `${matterContext.invoices.length} invoices`,
          `${matterContext.payments.length} payments`,
        ].join(', ')
      : 'basic case information only';

  const matterReference =
    getMatterReference(
      caseRecord,
    );

  if (
    normalized.includes(
      'summar',
    )
  ) {
    return [
      `Matter: ${matterReference}`,
      `Client: ${clientName}`,
      `Type: ${caseRecord.case_type ?? 'Not specified'}`,
      `Status: ${formatLabel(caseRecord.status)}`,
      `Priority: ${formatLabel(caseRecord.priority)}`,
      `Court: ${caseRecord.court ?? 'Not specified'}`,
      `Opponent: ${caseRecord.opponent_name ?? 'Not specified'}`,
      `Outstanding: ${formatCurrency(
        caseRecord.outstanding_balance,
        caseRecord.currency,
      )}`,
      '',
      'This is a preview summary generated from the case record currently available in the application. The connected AI version will also review hearings, tasks, notes, documents, activities, invoices and payments.',
    ].join('\n');
  }

  if (
    normalized.includes(
      'risk',
    )
  ) {
    return [
      `Preliminary Risk Review — ${matterReference}`,
      '',
      `Priority: ${formatLabel(caseRecord.priority)}`,
      `Risk level: ${formatLabel(caseRecord.risk_level)}`,
      `Urgent action: ${
        caseRecord.requires_urgent_action
          ? 'Required'
          : 'Not currently flagged'
      }`,
      `Next action: ${
        caseRecord.next_action_at
          ? new Date(
              caseRecord.next_action_at,
            ).toLocaleString(
              'en-AE',
            )
          : 'Not scheduled'
      }`,
      '',
      'Recommended review areas:',
      '• Confirm limitation and procedural deadlines.',
      '• Verify required supporting evidence.',
      '• Review outstanding client instructions.',
      '• Confirm hearing and filing preparation.',
      '• Review unpaid fees and recovery exposure.',
    ].join('\n');
  }

  if (
    normalized.includes(
      'next',
    )
  ) {
    return [
      `Recommended Next Actions — ${matterReference}`,
      '',
      '• Review the latest activity and notes.',
      '• Confirm the next hearing or filing deadline.',
      '• Close or update overdue tasks.',
      '• Verify that all supporting documents are uploaded.',
      '• Update the client regarding current progress.',
      '• Review outstanding fees and payment follow-up.',
    ].join('\n');
  }

  if (
    normalized.includes(
      'email',
    ) ||
    normalized.includes(
      'client update',
    )
  ) {
    return [
      `Subject: Update regarding ${matterReference}`,
      '',
      `Dear ${clientName},`,
      '',
      'We write to update you regarding the above matter.',
      '',
      `The matter is currently recorded as ${formatLabel(
        caseRecord.status,
      )}. We are reviewing the pending actions, supporting documents and upcoming procedural requirements.`,
      '',
      'We will continue to keep you informed of material developments. Please provide any outstanding documents or instructions requested by our team without delay.',
      '',
      'Kind regards,',
      'SHAB Legal Consultants FZC',
    ].join('\n');
  }

  if (
    normalized.includes(
      'notice',
    )
  ) {
    return [
      'WITHOUT PREJUDICE',
      '',
      `RE: ${matterReference}`,
      '',
      'We act on behalf of our client.',
      '',
      'You are hereby called upon to remedy the outstanding breaches and obligations relating to the above matter within the specified notice period.',
      '',
      'Failing satisfactory compliance, our client reserves the right to initiate all appropriate legal proceedings, claim damages, costs, interest and any other available relief without further notice.',
      '',
      'All rights and remedies are expressly reserved.',
      '',
      'This is a preview structure. The connected AI version will prepare the complete notice using the full matter record.',
    ].join('\n');
  }

  return [
    `Preview response for ${matterReference}:`,
    '',
    'The AI interface is working correctly. The next implementation stage will connect the assistant to the full matter context and an approved AI provider.',
    '',
    `Context loaded: ${sourceSummary}.`,
    '',
    `Your request was: “${prompt}”`,
    '',
    structuredPrompt
      ? `Structured legal prompt prepared locally (${structuredPrompt.length.toLocaleString('en-AE')} characters).`
      : 'Complete matter context is still loading.',
  ].join('\n');
}

function getMatterReference(
  caseRecord:
    CaseWithRelations,
): string {
  return (
    caseRecord.matter_number ??
    caseRecord.case_number ??
    caseRecord.case_type ??
    'Legal Matter'
  );
}

function formatLabel(
  value: unknown,
): string {
  const normalized =
    String(value ?? '')
      .trim()
      .replace(/_/g, ' ');

  if (!normalized) {
    return 'Not specified';
  }

  return normalized.replace(
    /\b\w/g,
    (letter) =>
      letter.toUpperCase(),
  );
}

function formatCurrency(
  value: unknown,
  currency: string | null | undefined,
): string {
  return new Intl.NumberFormat(
    'en-AE',
    {
      style: 'currency',
      currency:
        currency || 'AED',
      maximumFractionDigits: 0,
    },
  ).format(
    Number(value ?? 0),
  );
}

function formatTime(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    'en-AE',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(
    new Date(value),
  );
}
