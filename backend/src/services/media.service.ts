import path from 'path';
import { pathToFileURL } from 'url';
import { Types } from 'mongoose';
import { Media } from '../models/media.model';
import { IMedia, IMediaSearchQuery } from '../types/media.types';
import { HTTP_STATUS } from '../constants/httpStatus';
import { ApiResponse } from '../types/apiResponse.type';
import { deleteFile, getFileUrl } from '../utils/fileStorage';


const aiWorkflowModuleUrl = pathToFileURL(
  path.resolve(process.cwd(), "..", "ai-workflow", "processMedia.ts")
).href;

const loadAiWorkflowModule = async () => import(aiWorkflowModuleUrl);

/**
 * Upload and create media record
 */
export const uploadMediaService = async (
  userId: string,
  fileData: {
    filename: string;
    originalName: string;
    mimeType: string;
    fileType: 'image' | 'video' | 'document';
    fileSize: number;
    filePath: string;
    thumbnailPath?: string;
  }
): Promise<ApiResponse<IMedia>> => {
  try {
    const media = await Media.create({
      userId,
      ...fileData,
      fileUrl: getFileUrl(fileData.filename),
      status: 'uploading',
      uploadedAt: new Date(),
    });

    // Trigger AI processing asynchronously
    // Use setTimeout to avoid blocking the response
    setTimeout(async () => {
      try {
        // Dynamic import of AI workflow
        const aiWorkflow = await loadAiWorkflowModule();
        const mediaId = (media._id as unknown as Types.ObjectId).toString();

        console.log("=============================================================")
        await aiWorkflow.processMediaWithAI(mediaId, fileData.filePath, fileData.fileType);
      } catch (error: any) {
        console.error('AI processing failed:', error);
        // Update status to error
        await Media.findByIdAndUpdate(media._id as Types.ObjectId, {
          status: 'error',
          processingError: error.message,
        }).exec();
      }
    }, 100);

    return {
      code: HTTP_STATUS.CREATED,
      message: 'Media uploaded successfully',
      data: media.toObject() as IMedia,
    };
  } catch (error: any) {
    return {
      code: HTTP_STATUS.INTERNAL_SERVER,
      message: 'Failed to upload media',
      error: error.message,
    };
  }
};

/**
 * Get media by ID
 */
export const getMediaByIdService = async (
  mediaId: string,
  userId: string
): Promise<ApiResponse<IMedia>> => {
  try {
    const media = await Media.findOne({ _id: mediaId, userId });

    if (!media) {
      return {
        code: HTTP_STATUS.NOT_FOUND,
        message: 'Media not found',
      };
    }

    return {
      code: HTTP_STATUS.OK,
      message: 'Media retrieved successfully',
      data: media.toObject() as IMedia,
    };
  } catch (error: any) {
    return {
      code: HTTP_STATUS.INTERNAL_SERVER,
      message: 'Failed to retrieve media',
      error: error.message,
    };
  }
};

/**
 * Get all media with filters and search
 */
export const getMediaService = async (
  userId: string,
  query: IMediaSearchQuery
): Promise<ApiResponse<{ media: IMedia[]; total: number; page: number; limit: number }>> => {
  try {
    const {
      query: searchQuery,
      type,
      tags,
      topics,
      page = 1,
      limit = 20,
    } = query;

    const filter: any = { userId };

    // Filter by file type
    if (type && type !== 'all') {
      filter.fileType = type;
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      filter.tags = { $in: tags };
    }

    // Filter by topics
    if (topics && topics.length > 0) {
      filter.topics = { $in: topics };
    }

    // Text search (will be enhanced with semantic search)
    if (searchQuery) {
      filter.$or = [
        { originalName: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(searchQuery, 'i')] } },
        { topics: { $in: [new RegExp(searchQuery, 'i')] } },
      ];
    }

    const skip = (page - 1) * limit;

    const [media, total] = await Promise.all([
      Media.find(filter)
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Media.countDocuments(filter),
    ]);

    return {
      code: HTTP_STATUS.OK,
      message: 'Media retrieved successfully',
      data: {
        media: media as IMedia[],
        total,
        page,
        limit,
      },
    };
  } catch (error: any) {
    return {
      code: HTTP_STATUS.INTERNAL_SERVER,
      message: 'Failed to retrieve media',
      error: error.message,
    };
  }
};

/**
 * Semantic search using embeddings
 */
export const searchMediaService = async (
  userId: string,
  query: string,
  limit: number = 20
): Promise<ApiResponse<{ media: IMedia[]; total: number }>> => {
  try {
    // Import AI workflow function for semantic search
    const { generateEmbedding, findSimilarMedia } = await loadAiWorkflowModule();

    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(query);

    // Find similar media using vector similarity
    const similarMedia = await findSimilarMedia(
      userId,
      queryEmbedding,
      limit
    );

    return {
      code: HTTP_STATUS.OK,
      message: 'Search completed successfully',
      data: {
        media: similarMedia,
        total: similarMedia.length,
      },
    };
  } catch (error: any) {
    return {
      code: HTTP_STATUS.INTERNAL_SERVER,
      message: 'Search failed',
      error: error.message,
    };
  }
};

/**
 * Update media metadata
 */
export const updateMediaService = async (
  mediaId: string,
  userId: string,
  updates: Partial<IMedia>
): Promise<ApiResponse<IMedia>> => {
  try {
    const media = await Media.findOneAndUpdate(
      { _id: mediaId, userId },
      { $set: updates },
      { new: true }
    );

    if (!media) {
      return {
        code: HTTP_STATUS.NOT_FOUND,
        message: 'Media not found',
      };
    }

    return {
      code: HTTP_STATUS.OK,
      message: 'Media updated successfully',
      data: media.toObject() as IMedia,
    };
  } catch (error: any) {
    return {
      code: HTTP_STATUS.INTERNAL_SERVER,
      message: 'Failed to update media',
      error: error.message,
    };
  }
};

/**
 * Delete media
 */
export const deleteMediaService = async (
  mediaId: string,
  userId: string
): Promise<ApiResponse<void>> => {
  try {
    const media = await Media.findOne({ _id: mediaId, userId });

    if (!media) {
      return {
        code: HTTP_STATUS.NOT_FOUND,
        message: 'Media not found',
      };
    }

    // Delete file from storage
    await deleteFile(media.filePath);
    if (media.thumbnailPath) {
      await deleteFile(media.thumbnailPath);
    }

    // Delete from database
    await Media.findByIdAndDelete(mediaId);

    return {
      code: HTTP_STATUS.OK,
      message: 'Media deleted successfully',
    };
  } catch (error: any) {
    return {
      code: HTTP_STATUS.INTERNAL_SERVER,
      message: 'Failed to delete media',
      error: error.message,
    };
  }
};

