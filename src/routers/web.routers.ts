import express, { Router } from 'express';
import { showHome } from '../controllers/AuthController';

const router = Router();

router.get('/', showHome);


export default router;
