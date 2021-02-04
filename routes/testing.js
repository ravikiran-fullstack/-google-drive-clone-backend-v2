import express from 'express';
const router = express.Router();

import { getTesting, postTesting } from '../controllers/testing.js';

router.get('/testing', (req, res, next) => {
  res.send('Hello testing works');
});

router.post('/testing', (req, res, next) => {
  res.send('post is also working');
});

export default router;