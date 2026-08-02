import {
  supabase,
} from '../lib/supabase';

export type AIRequest = {
  prompt: string;
  matterId: string;
  action?: string;
};

export type AIResponse = {
  text: string;
  responseId: string | null;
  model: string;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
};

export async function requestAIResponse(
  request: AIRequest,
): Promise<AIResponse> {
  const prompt =
    request.prompt.trim();

  if (!prompt) {
    throw new Error(
      'An AI prompt is required.',
    );
  }

  const sessionResult =
    await supabase.auth
      .getSession();

  if (
    sessionResult.error
  ) {
    throw new Error(
      sessionResult.error.message,
    );
  }

  if (
    !sessionResult.data
      .session
  ) {
    throw new Error(
      'Your session has expired. Please sign in again.',
    );
  }

  const result =
    await supabase.functions
      .invoke(
        'shab-ai',
        {
          body: {
            prompt,
            matterId:
              request.matterId,
            action:
              request.action ??
              'custom',
          },
        },
      );

  if (result.error) {
    throw new Error(
      await getFunctionErrorMessage(
        result.error,
      ),
    );
  }

  const data =
    result.data as
      Partial<AIResponse> & {
        error?: unknown;
      };

  if (
    typeof data.error ===
      'string'
  ) {
    throw new Error(
      data.error,
    );
  }

  if (
    typeof data.text !==
      'string' ||
    !data.text.trim()
  ) {
    throw new Error(
      'The AI service returned an empty response.',
    );
  }

  return {
    text:
      data.text.trim(),

    responseId:
      typeof data.responseId ===
        'string'
        ? data.responseId
        : null,

    model:
      typeof data.model ===
        'string'
        ? data.model
        : 'unknown',

    usage:
      data.usage &&
      typeof data.usage ===
        'object'
        ? data.usage
        : null,
  };
}

async function getFunctionErrorMessage(
  error: unknown,
): Promise<string> {
  if (
    error &&
    typeof error ===
      'object'
  ) {
    const context =
      (
        error as {
          context?: unknown;
        }
      ).context;

    if (
      context instanceof
      Response
    ) {
      try {
        const body =
          await context.json() as {
            error?: unknown;
          };

        if (
          typeof body.error ===
            'string'
        ) {
          return body.error;
        }
      } catch {
        // Continue to the standard error message.
      }
    }

    if (
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

  return 'Unable to contact the AI service.';
}
