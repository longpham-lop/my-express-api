import express, { Router } from "express";
import upload from "../middlewares/upload";
import { uploadImage } from "../controllers/UploadController";

const router = Router();

router.post(
  "/upload",
  upload.single("image"),
  uploadImage
);

export default router;