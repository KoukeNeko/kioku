// scripts/verify-furigana.ts

export interface FuriganaChunk {
    ruby: string;
    rt?: string;
}

/**
 * Validates and normalizes the furigana chunk structure.
 */
export function normalizeFurigana(chunks: Partial<FuriganaChunk>[]): FuriganaChunk[] {
    return chunks.map(chunk => {
        if (!chunk.ruby) {
            throw new Error("Invalid FuriganaChunk: missing 'ruby' text");
        }
        return {
            ruby: chunk.ruby,
            rt: chunk.rt
        };
    });
}

function verifyFurigana() {
    console.log("Starting Furigana Harness...");

    const rawData = [
        { ruby: "大人", rt: "おとな" },
        { ruby: "買", rt: "が" },
        { ruby: "い" }
    ];

    try {
        const normalized = normalizeFurigana(rawData);
        console.log("Normalized Chunks:", JSON.stringify(normalized, null, 2));
        
        if (normalized.length !== 3 || normalized[0].rt !== "おとな") {
            throw new Error("Logic error in normalization.");
        }
        console.log("SUCCESS: Furigana parsing logic works.");
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}

// Only run if executed directly
if (require.main === module) {
    verifyFurigana();
}
