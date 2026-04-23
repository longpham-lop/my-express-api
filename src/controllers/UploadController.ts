import { Request, Response } from "express";
import cloudinary from "../config/cloudinary";
import streamifier from "streamifier";

export const uploadImage = async (
  req: Request,
  res: Response
) => {
  try {
    console.log("=== UPLOAD START ===");
    console.log("req.file:", req.file);
    console.log(
      "cloud name:",
      process.env.CLOUDINARY_CLOUD_NAME
    );

    if (!req.file) {
      return res.status(400).json({
        message: "Không có file ảnh",
      });
    }

    const streamUpload = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "restaurant",
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary error:", error);
              reject(error);
              return;
            }

            if (result) {
              resolve(result);
            } else {
              reject(new Error("Upload result is null"));
            }
          }
        );

        streamifier
          .createReadStream(req.file!.buffer)
          .pipe(stream);
      });
    };

    const result = await streamUpload();

    console.log("UPLOAD SUCCESS:", result);

    return res.status(200).json({
      imageUrl: result.secure_url,
    });
  } catch (error) {
    console.error("UPLOAD FAILED:", error);

    return res.status(500).json({
      message: "Upload thất bại",
    });
  }
};