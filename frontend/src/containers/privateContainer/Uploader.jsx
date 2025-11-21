import { useState } from "react";
<<<<<<< HEAD
import UploaderComponent from "../../components/privateComponents/uploader/Uploader";
=======
import { toast } from "react-toastify";
import UploaderComponent from "../../components/privateComponents/uploader/Uploader";
import { useUploadMediaMutation } from "../../features/apiSlices/dashboardApis";
>>>>>>> main

/**
 * Uploader Container Component
 * Handles all business logic for file uploads
 * - File processing
 * - Server upload
 * - State management
 * - Upload status tracking
 */
const Uploader = () => {
  const [uploadStatus, setUploadStatus] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
<<<<<<< HEAD
=======
  const [uploadMedia] = useUploadMediaMutation();
>>>>>>> main

  /**
   * Handle files selected from Uploader component
   * Receives array of file objects with all required information
   */
  const handleFilesSelected = async (files) => {
<<<<<<< HEAD
    console.log("Files selected:", files);
    
    // Process files for server upload
    const filesForUpload = files.map((fileInfo) => {
      return {
        // File object for FormData
        file: fileInfo.file,
        // Metadata for server
        name: fileInfo.name,
        size: fileInfo.size,
        type: fileInfo.type,
        category: fileInfo.category,
        // Additional information
        metadata: fileInfo.metadata,
        // You can add more processing here (e.g., generate thumbnails, extract metadata)
      };
    });
=======
    if (!files || files.length === 0) return;
>>>>>>> main

    // Initialize upload status for all files
    const initialStatus = {};
    const initialProgress = {};
<<<<<<< HEAD
    filesForUpload.forEach((fileInfo) => {
=======
    files.forEach((fileInfo) => {
>>>>>>> main
      initialStatus[fileInfo.name] = "uploading";
      initialProgress[fileInfo.name] = 0;
    });
    setUploadStatus(initialStatus);
    setUploadProgress(initialProgress);

    // Upload files to server
<<<<<<< HEAD
    await uploadFilesToServer(filesForUpload);
=======
    await uploadFilesToServer(files);
>>>>>>> main
  };

  /**
   * Upload files to server
<<<<<<< HEAD
   * Simulates file upload with progress tracking
=======
   * Uses RTK Query mutation for file upload
>>>>>>> main
   */
  const uploadFilesToServer = async (files) => {
    for (const fileInfo of files) {
      try {
<<<<<<< HEAD
        // Simulate upload progress
        const interval = setInterval(() => {
=======
        // Create FormData for file upload
        const formData = new FormData();
        formData.append("file", fileInfo.file);

        // Simulate upload progress (since RTK Query doesn't provide progress)
        const progressInterval = setInterval(() => {
>>>>>>> main
          setUploadProgress((prev) => {
            const current = prev[fileInfo.name] || 0;
            if (current < 90) {
              return {
                ...prev,
<<<<<<< HEAD
                [fileInfo.name]: current + Math.random() * 10,
=======
                [fileInfo.name]: Math.min(current + Math.random() * 15, 90),
>>>>>>> main
              };
            }
            return prev;
          });
<<<<<<< HEAD
        }, 200);

        // TODO: Replace with actual API call
        // const formData = new FormData();
        // formData.append("file", fileInfo.file);
        // formData.append("metadata", JSON.stringify(fileInfo.metadata));
        
        // const response = await fetch("/api/upload", {
        //   method: "POST",
        //   body: formData,
        //   onUploadProgress: (progressEvent) => {
        //     const percentCompleted = Math.round(
        //       (progressEvent.loaded * 100) / progressEvent.total
        //     );
        //     setUploadProgress((prev) => ({
        //       ...prev,
        //       [fileInfo.name]: percentCompleted,
        //     }));
        //   },
        // });

        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 2000));

        clearInterval(interval);
=======
        }, 300);

        // Upload file using RTK Query
        const result = await uploadMedia(formData).unwrap();

        clearInterval(progressInterval);
>>>>>>> main

        // Set progress to 100%
        setUploadProgress((prev) => ({
          ...prev,
          [fileInfo.name]: 100,
        }));

        // Mark as success
        setUploadStatus((prev) => ({
          ...prev,
          [fileInfo.name]: "success",
        }));

<<<<<<< HEAD
        console.log(`Successfully uploaded: ${fileInfo.name}`);
=======
        toast.success(`Uploaded: ${fileInfo.name}`);
>>>>>>> main
      } catch (error) {
        // Mark as error
        setUploadStatus((prev) => ({
          ...prev,
          [fileInfo.name]: "error",
        }));

<<<<<<< HEAD
        console.error(`Error uploading ${fileInfo.name}:`, error);
      }
    }

    // After all uploads complete, you can:
    // - Show success message
    // - Redirect to dashboard
    // - Update media library
=======
        toast.error(`Failed to upload ${fileInfo.name}: ${error?.data?.message || error.message || "Unknown error"}`);
        console.error(`Error uploading ${fileInfo.name}:`, error);
      }
    }
>>>>>>> main
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1450px]">
      <UploaderComponent
        onFilesSelected={handleFilesSelected}
        maxFileSize={50}
        acceptedTypes={[
          "image/*",
          "video/*",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]}
        uploadStatus={uploadStatus}
        uploadProgress={uploadProgress}
      />
    </div>
  );
};

export default Uploader;

