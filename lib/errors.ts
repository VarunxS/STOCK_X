export function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback
}

export function errorDetails(error: unknown) {
    const cause = error instanceof Error ? error.cause : undefined
    return {
        message: errorMessage(error, String(error)),
        name: error instanceof Error ? error.name : '',
        cause: cause instanceof Error ? cause.message : '',
    }
}
