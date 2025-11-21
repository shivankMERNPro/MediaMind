import OpenAI from "openai";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

// ---------------------------------------------------
// 1. AUTO-LOAD MEDIA MODEL (TS in dev, JS in prod)
// ---------------------------------------------------
let Media: any = null;

const loadMediaModel = async () => {
  if (Media) return Media;

  try {
    // ⭐ DEVELOPMENT MODE — nodemon + ts-node
    const tsModule: any = await import("../backend/src/models/media.model.ts");
    Media = tsModule.Media || tsModule.default;
    console.log("✅ Loaded Media model (TS dev mode)");
    return Media;
  } catch (err) {
    console.log("⚠️ TS model not found, switching to JS build...");
  }

  try {
    // ⭐ PRODUCTION MODE — compiled JS
    const jsModule = await import("../backend/dist/models/media.model.js");
    Media = jsModule.Media || jsModule.default;
    console.log("✅ Loaded Media model (JS production mode)");
    return Media;
  } catch (err) {
    console.error("❌ Cannot load Media model in TS or JS mode.");
    throw err;
  }
};

// ---------------------------------------------------
// 2. CONNECT TO MONGO
// ---------------------------------------------------
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("❌ MONGO_URI missing");

  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DB_NAME,
  });

  await loadMediaModel();
};

// ---------------------------------------------------
// 3. OPENAI CLIENT
// ---------------------------------------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// ---------------------------------------------------
// 4. DESCRIPTION GENERATION
// ---------------------------------------------------
export const generateDescription = async (filePath: string, fileType: "image" | "video" | "document") => {
  try {
    if (fileType === "image") {
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString("base64");

      const result = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Generate a 1-sentence description of this image." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          },
        ],
      });

      return result.choices[0]?.message?.content || "Description unavailable";
    }

    if (fileType === "video") return "Video uploaded";
    return "Document uploaded";
  } catch (err) {
    console.error("Description error:", err);
    return "Failed to generate description";
  }
};

// ---------------------------------------------------
// 5. TAG GENERATION
// ---------------------------------------------------
export const generateTags = async (description: string, fileType: string) => {
  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return JSON { tags: [] } with 3–8 lowercase tags." },
        { role: "user", content: `Generate tags for a ${fileType}: ${description}` },
      ],
      response_format: { type: "json_object" },
    });

    const json = JSON.parse(result.choices[0]?.message?.content || "{}");
    return json.tags || [];
  } catch {
    return [];
  }
};

// ---------------------------------------------------
// 6. TOPIC GENERATION
// ---------------------------------------------------
export const generateTopics = async (description: string, tags: string[]) => {
  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return JSON { topics: [] } with 1–3 broad topics." },
        { role: "user", content: `Description: ${description}. Tags: ${tags.join(", ")}` },
      ],
      response_format: { type: "json_object" },
    });

    const json = JSON.parse(result.choices[0]?.message?.content || "{}");
    return json.topics || [];
  } catch {
    return [];
  }
};

// ---------------------------------------------------
// 7. EMBEDDING
// ---------------------------------------------------
export const generateEmbedding = async (text: string) => {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return r.data[0].embedding;
};

// ---------------------------------------------------
// 8. SIMILAR MEDIA FINDER
// ---------------------------------------------------
const cosine = (A: number[], B: number[]) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < A.length; i++) {
    dot += A[i] * B[i];
    na += A[i] ** 2;
    nb += B[i] ** 2;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

export const findSimilarMedia = async (userId: string, queryEmbedding: number[], limit = 20) => {
  await connectDB();

  const all = await Media.find({
    userId,
    status: "ready",
    embedding: { $exists: true, $ne: [] },
  }).lean();

  return all
    .map((item: any) => {
      if (!item.embedding) return null;
      const score = cosine(item.embedding, queryEmbedding);
      if (score < 0.5) return null;
      return { ...item, similarity: score };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, limit);
};

// ---------------------------------------------------
// 9. MAIN PROCESSOR
// ---------------------------------------------------
export const processMediaWithAI = async (mediaId: string, filePath: string, fileType: "image" | "video" | "document") => {
  try {
    await connectDB();

    await Media.findByIdAndUpdate(mediaId, { status: "analyzing" });

    const description = await generateDescription(filePath, fileType);
    const tags = await generateTags(description, fileType);
    const topics = await generateTopics(description, tags);
    const embedding = await generateEmbedding(`${description} ${tags.join(" ")} ${topics.join(" ")}`);

    await Media.findByIdAndUpdate(mediaId, {
      description,
      tags,
      topics,
      embedding,
      status: "ready",
      analyzedAt: new Date(),
    });

    console.log(`✅ AI processing finished for ${mediaId}`);
  } catch (err: any) {
    console.error(`❌ AI processing failed for ${mediaId}:`, err);
    await Media.findByIdAndUpdate(mediaId, {
      status: "error",
      processingError: err.message,
    });
  }
};

export default {
  processMediaWithAI,
  generateDescription,
  generateTags,
  generateTopics,
  generateEmbedding,
  findSimilarMedia,
};
