import { Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import { AuthService, WebsiteService, UserService, ConversationService, MessageService, AttachmentService, NotificationService } from '../services';
import { AppError } from '../middleware/errorHandler';

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export class AuthController {
  static async widgetAuth(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const websiteId = req.website!._id.toString();
      const { externalId, email, displayName, avatarUrl } = req.body;

      const result = await AuthService.registerWidgetUser(websiteId, {
        externalId,
        email,
        displayName,
        avatarUrl,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async login(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, password, websiteId } = req.body;
      const result = await AuthService.login(email, password, websiteId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async register(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const websiteId = req.website!._id.toString();
      const { email, displayName, password, avatarUrl } = req.body;
      const result = await AuthService.registerWithPassword(websiteId, {
        email,
        displayName,
        password,
        avatarUrl,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.updateProfile(req.user!.userId, req.body);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  static async googleConfig(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { config } = await import('../config');
      res.json({
        success: true,
        data: {
          enabled: Boolean(config.google.clientId),
          clientId: config.google.clientId || null,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async googleAuth(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const websiteId = req.website!._id.toString();
      const { credential } = req.body;
      const result = await AuthService.loginWithGoogle(websiteId, credential);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async adminLogin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.adminLogin(email, password);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.slice(7);
      if (token) await AuthService.logout(token);
      res.json({ success: true, message: 'Logged out' });
    } catch (err) {
      next(err);
    }
  }

  static async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { User } = await import('../models');
      const user = await User.findById(req.user!.userId).select('-passwordHash');
      if (!user) throw new AppError(404, 'User not found');
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
}

export const authValidators = {
  widget: [
    body('email').isEmail().normalizeEmail(),
    body('displayName').trim().isLength({ min: 1, max: 100 }),
    body('externalId').optional().trim(),
    body('avatarUrl').optional().isURL(),
  ],
  login: [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('websiteId').optional().isMongoId(),
  ],
  register: [
    body('email').isEmail().normalizeEmail(),
    body('displayName').trim().isLength({ min: 1, max: 100 }),
    body('password').isLength({ min: 6 }),
    body('avatarUrl').optional().isString(),
  ],
  profile: [
    body('displayName').optional().trim().isLength({ min: 1, max: 100 }),
    body('avatarUrl').optional().isString(),
  ],
  google: [body('credential').isString().isLength({ min: 10 })],
};

export class WebsiteController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const website = await WebsiteService.create(req.body);
      res.status(201).json({ success: true, data: website });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await WebsiteService.list(
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 20
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const website = await WebsiteService.getById(paramId(req.params.id));
      res.json({ success: true, data: website });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const website = await WebsiteService.update(paramId(req.params.id), req.body);
      res.json({ success: true, data: website });
    } catch (err) {
      next(err);
    }
  }

  static async verify(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const website = await WebsiteService.verify(paramId(req.params.id));
      res.json({ success: true, data: website });
    } catch (err) {
      next(err);
    }
  }

  static async regenerateKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const website = await WebsiteService.regenerateApiKey(paramId(req.params.id));
      res.json({ success: true, data: website });
    } catch (err) {
      next(err);
    }
  }

  static async analytics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const analytics = await WebsiteService.getAnalytics(paramId(req.params.id));
      res.json({ success: true, data: analytics });
    } catch (err) {
      next(err);
    }
  }

  static async publicConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const website = req.website!;
      res.json({
        success: true,
        data: {
          websiteId: website._id,
          name: website.name,
          branding: website.branding,
          settings: website.settings,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export class UserController {
  static async search(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await UserService.search(
        req.user!.websiteId,
        req.query.q as string,
        req.user!.userId,
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 20
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const websiteId = (req.query.websiteId as string) || req.user!.websiteId;
      const result = await UserService.listByWebsite(
        websiteId,
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 20
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async block(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await UserService.blockUser(paramId(req.params.id), req.body.blocked ?? true);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
}

export class ConversationController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await ConversationService.listForUser(
        req.user!.websiteId,
        req.user!.userId,
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 20
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const conversation = await ConversationService.getOrCreate(
        req.user!.websiteId,
        req.user!.userId,
        req.body.participantId
      );
      res.json({ success: true, data: conversation });
    } catch (err) {
      next(err);
    }
  }

  static async search(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const results = await ConversationService.search(
        req.user!.websiteId,
        req.user!.userId,
        req.query.q as string
      );
      res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  }

  static async unreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const count = await ConversationService.getUnreadTotal(req.user!.userId);
      res.json({ success: true, data: { count } });
    } catch (err) {
      next(err);
    }
  }
}

export class MessageController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await MessageService.list(
        paramId(req.params.conversationId),
        req.user!.userId,
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 30
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async send(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const message = await MessageService.send(
        req.user!.websiteId,
        req.body.conversationId,
        req.user!.userId,
        req.body.content,
        req.body.replyTo,
        req.body.attachmentIds
      );
      res.status(201).json({ success: true, data: message });
    } catch (err) {
      next(err);
    }
  }

  static async edit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const message = await MessageService.edit(paramId(req.params.id), req.user!.userId, req.body.content);
      res.json({ success: true, data: message });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const message = await MessageService.delete(paramId(req.params.id), req.user!.userId, req.user!.role);
      res.json({ success: true, data: message });
    } catch (err) {
      next(err);
    }
  }

  static async react(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const message = await MessageService.react(paramId(req.params.id), req.user!.userId, req.body.emoji);
      res.json({ success: true, data: message });
    } catch (err) {
      next(err);
    }
  }

  static async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await MessageService.markRead(
        paramId(req.params.conversationId),
        req.user!.userId,
        req.body.messageIds
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export class AttachmentController {
  static async upload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError(400, 'No file uploaded');
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const attachment = await AttachmentService.create(
        req.user!.websiteId,
        req.user!.userId,
        req.file,
        baseUrl,
        {
          isEncrypted: req.body.isEncrypted === 'true',
          encryptionIv: req.body.encryptionIv,
          originalMimeType: req.body.originalMimeType,
          encryptedOriginalName: req.body.encryptedOriginalName,
        }
      );
      res.status(201).json({ success: true, data: attachment });
    } catch (err) {
      next(err);
    }
  }
}

export class NotificationController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await NotificationService.list(
        req.user!.userId,
        parseInt(req.query.page as string) || 1,
        parseInt(req.query.limit as string) || 20
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await NotificationService.markRead(paramId(req.params.id), req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async markAllRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await NotificationService.markAllRead(req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
