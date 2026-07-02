import { Router } from 'express';
import {
  AuthController,
  authValidators,
  WebsiteController,
  UserController,
  ConversationController,
  MessageController,
  AttachmentController,
  NotificationController,
} from '../controllers';
import { authenticate, validateApiKey, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter, uploadLimiter } from '../middleware/rateLimiter';
import { upload } from '../utils/upload';
import { body } from 'express-validator';

const router = Router();

// Public / API key routes
router.get('/websites/config', validateApiKey, WebsiteController.publicConfig);
router.post('/auth/widget', validateApiKey, authLimiter, validate(authValidators.widget), AuthController.widgetAuth);
router.post('/auth/register', validateApiKey, authLimiter, validate(authValidators.register), AuthController.register);
router.get('/auth/google/config', AuthController.googleConfig);
router.post('/auth/google', validateApiKey, authLimiter, validate(authValidators.google), AuthController.googleAuth);
router.post('/auth/login', authLimiter, validate(authValidators.login), AuthController.login);
router.post('/auth/admin/login', authLimiter, validate(authValidators.login), AuthController.adminLogin);

// Authenticated routes
router.use(authenticate);

router.get('/auth/me', AuthController.me);
router.patch('/auth/profile', validate(authValidators.profile), AuthController.updateProfile);
router.post('/auth/logout', AuthController.logout);

router.get('/conversations', ConversationController.list);
router.post('/conversations', body('participantId').isMongoId(), validate([body('participantId')]), ConversationController.create);
router.get('/conversations/search', ConversationController.search);
router.get('/conversations/unread', ConversationController.unreadCount);

router.get('/conversations/:conversationId/messages', MessageController.list);
router.post('/messages', MessageController.send);
router.patch('/messages/:id', MessageController.edit);
router.delete('/messages/:id', MessageController.delete);
router.post('/messages/:id/react', body('emoji').isString(), validate([body('emoji')]), MessageController.react);
router.post('/conversations/:conversationId/read', MessageController.markRead);

router.get('/users/search', UserController.search);

router.post('/attachments', uploadLimiter, upload.single('file'), AttachmentController.upload);

router.get('/notifications', NotificationController.list);
router.patch('/notifications/:id/read', NotificationController.markRead);
router.post('/notifications/read-all', NotificationController.markAllRead);

// Admin routes
router.get('/admin/websites', requireAdmin, WebsiteController.list);
router.post('/admin/websites', requireAdmin, WebsiteController.create);
router.get('/admin/websites/:id', requireAdmin, WebsiteController.get);
router.patch('/admin/websites/:id', requireAdmin, WebsiteController.update);
router.post('/admin/websites/:id/verify', requireAdmin, WebsiteController.verify);
router.post('/admin/websites/:id/regenerate-key', requireAdmin, WebsiteController.regenerateKey);
router.get('/admin/websites/:id/analytics', requireAdmin, WebsiteController.analytics);

router.get('/admin/users', requireAdmin, UserController.list);
router.patch('/admin/users/:id/block', requireAdmin, UserController.block);

router.get('/admin/messages', requireAdmin, MessageController.adminList);
router.delete('/admin/messages/:id', requireAdmin, MessageController.delete);

export default router;
