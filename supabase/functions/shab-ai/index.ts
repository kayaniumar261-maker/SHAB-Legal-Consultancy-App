const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

type AIRequestBody = {
  prompt?: unknown;
  matterId?: unknown;
  action?: unknown;
};

type OpenAIResponse = {
  id?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    code?: string;
  };
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(
      'ok',
      {
        headers: corsHeaders,
      },
    );
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      {
        error:
          'Method not allowed.',
      },
      405,
    );
  }

  try {
    const authorization =
      request.headers.get(
        'Authorization',
      );

    if (
      !authorization?.startsWith(
        'Bearer ',
      )
    ) {
      return jsonResponse(
        {
          error:
            'Authentication is required.',
        },
        401,
      );
    }

    const body =
      await request.json() as
        AIRequestBody;

    const prompt =
      typeof body.prompt ===
      'string'
        ? body.prompt.trim()
        : '';

    const matterId =
      typeof body.matterId ===
      'string'
        ? body.matterId
        : null;

    const action =
      typeof body.action ===
      'string'
        ? body.action
        : 'custom';

    if (!prompt) {
      return jsonResponse(
        {
          error:
            'A prompt is required.',
        },
        400,
      );
    }

    if (prompt.length > 120_000) {
      return jsonResponse(
        {
          error:
            'The matter context is too large. Reduce the number or size of included records.',
        },
        413,
      );
    }

    const apiKey =
      Deno.env.get(
        'OPENAI_API_KEY',
      );

    const model =
      Deno.env.get(
        'OPENAI_MODEL',
      );

    if (!apiKey) {
      console.error(
        '[SHAB AI] OPENAI_API_KEY is missing.',
      );

      return jsonResponse(
        {
          error:
            'The AI service has not been configured.',
        },
        503,
      );
    }

    if (!model) {
      console.error(
        '[SHAB AI] OPENAI_MODEL is missing.',
      );

      return jsonResponse(
        {
          error:
            'The AI model has not been configured.',
        },
        503,
      );
    }

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        90_000,
      );

    let openAIResponse:
      Response;

    try {
      openAIResponse =
        await fetch(
          'https://api.openai.com/v1/responses',
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${apiKey}`,
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                model,

                store: false,

                instructions:
                  [
                    'You are SHAB Legal Consultancy’s internal legal drafting assistant.',
                    'Use only the facts and records supplied in the user input.',
                    'Never invent names, dates, documents, amounts, procedural events, evidence, admissions, or legal authorities.',
                    'Clearly identify missing, uncertain, contradictory, or unverified information.',
                    'Use a professional legal tone suitable for a UAE legal consultancy.',
                    'Do not present the output as final legal advice or as a filed court document.',
                    'Preserve confidentiality.',
                    'Where the request is client-facing, exclude private internal commentary unless expressly requested.',
                    'Organize longer responses with clear headings and practical next actions.',
                  ].join(' '),

                input: prompt,
              }),

            signal:
              controller.signal,
          },
        );
    } finally {
      clearTimeout(timeout);
    }

    const responseBody =
      await safeJson(
        openAIResponse,
      );

    if (
      !openAIResponse.ok
    ) {
      const apiMessage =
        getOpenAIError(
          responseBody,
        );

      console.error(
        '[SHAB AI] OpenAI request failed.',
        {
          status:
            openAIResponse.status,
          matterId,
          action,
          message:
            apiMessage,
        },
      );

      return jsonResponse(
        {
          error:
            apiMessage ||
            'The AI provider rejected the request.',
        },
        mapProviderStatus(
          openAIResponse.status,
        ),
      );
    }

    const parsedResponse =
      responseBody as
        OpenAIResponse;

    const outputText =
      extractOutputText(
        parsedResponse,
      );

    if (!outputText) {
      console.error(
        '[SHAB AI] Empty model response.',
        {
          matterId,
          action,
          responseId:
            parsedResponse.id,
        },
      );

      return jsonResponse(
        {
          error:
            'The AI provider returned an empty response.',
        },
        502,
      );
    }

    console.info(
      '[SHAB AI] Request completed.',
      {
        matterId,
        action,
        responseId:
          parsedResponse.id ??
          null,
        inputTokens:
          parsedResponse.usage
            ?.input_tokens ??
          null,
        outputTokens:
          parsedResponse.usage
            ?.output_tokens ??
          null,
      },
    );

    return jsonResponse(
      {
        text: outputText,
        responseId:
          parsedResponse.id ??
          null,
        model,
        usage:
          parsedResponse.usage ??
          null,
      },
      200,
    );
  } catch (error) {
    if (
      error instanceof
        DOMException &&
      error.name ===
        'AbortError'
    ) {
      return jsonResponse(
        {
          error:
            'The AI request timed out. Please try again.',
        },
        504,
      );
    }

    console.error(
      '[SHAB AI] Unexpected function error.',
      error,
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected AI service error.',
      },
      500,
    );
  }
});

function jsonResponse(
  body: unknown,
  status: number,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...corsHeaders,
        'Content-Type':
          'application/json; charset=utf-8',
        'Cache-Control':
          'no-store',
      },
    },
  );
}

async function safeJson(
  response: Response,
): Promise<unknown> {
  const text =
    await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: {
        message: text,
      },
    };
  }
}

function extractOutputText(
  response: OpenAIResponse,
): string {
  if (
    typeof response.output_text ===
      'string' &&
    response.output_text.trim()
  ) {
    return response.output_text.trim();
  }

  const parts: string[] =
    [];

  for (
    const outputItem of
    response.output ?? []
  ) {
    for (
      const contentItem of
      outputItem.content ?? []
    ) {
      if (
        contentItem.type ===
          'output_text' &&
        typeof contentItem.text ===
          'string'
      ) {
        parts.push(
          contentItem.text,
        );
      }
    }
  }

  return parts
    .join('\n')
    .trim();
}

function getOpenAIError(
  value: unknown,
): string | null {
  if (
    value &&
    typeof value ===
      'object' &&
    'error' in value
  ) {
    const error =
      (
        value as {
          error?: unknown;
        }
      ).error;

    if (
      error &&
      typeof error ===
        'object' &&
      'message' in error &&
      typeof (
        error as {
          message?: unknown;
        }
      ).message ===
        'string'
    ) {
      return (
        error as {
          message: string;
        }
      ).message;
    }
  }

  return null;
}

function mapProviderStatus(
  providerStatus: number,
): number {
  if (
    providerStatus === 401 ||
    providerStatus === 403
  ) {
    return 503;
  }

  if (
    providerStatus === 429
  ) {
    return 429;
  }

  if (
    providerStatus >= 500
  ) {
    return 502;
  }

  return 400;
}
