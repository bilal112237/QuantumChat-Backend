import { Types } from 'mongoose';
import { User, Website, Conversation, Message, Notification, Attachment } from '../models';
import { AppError } from '../middleware/errorHandler';
import {
  generateApiKey,
  generateTenantId,
  hashPassword,
  comparePassword,
  signToken,
  createSession,
  toPublicUser,
  paginate,
} from '../utils/helpers';
import { USER_ROLES, MESSAGE_STATUS } from '@quantum-chat/shared';
import type { AuthPayload } from '../middleware/auth';

export class AuthService {
  static async registerWidgetUser(
    websiteId: string,
    data: { externalId?: string; email: string; displayName: string; avatarUrl?: string }
  ) {
    const website = await Website.findById(websiteId);
    if (!website?.isActive) throw new AppError(404, 'Website not found');

    let user = await User.findOne({
      websiteId,
      $or: [{ email: data.email }, ...(data.externalId ? [{ externalId: data.externalId }] : [])],
    });

    if (!user) {
      user = await User.create({
        websiteId,
        externalId: data.externalId,
        email: data.email,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        role: USER_ROLES.USER,
      });
    } else {
      user.displayName = data.displayName;
      if (data.avatarUrl) user.avatarUrl = data.avatarUrl;
      if (data.externalId) user.externalId = data.externalId;
      await user.save();
    }

    const payload: AuthPayload = {
      userId: user._id.toString(),
      websiteId: user.websiteId.toString(),
      role: user.role,
      email: user.email,
    };

    const token = signToken(payload);
    await createSession(user._id.toString(), websiteId, token);

    return { user: toPublicUser(user), token, website: { name: website.name, branding: website.branding, settings: website.settings } };
  }

  static async registerWithPassword(
    websiteId: string,
    data: { email: string; displayName: string; password: string; avatarUrl?: string }
  ) {
    const website = await Website.findById(websiteId);
    if (!website?.isActive) throw new AppError(404, 'Website not found');

    const email = data.email.toLowerCase();
    const existing = await User.findOne({ websiteId, email });
    if (existing) throw new AppError(409, 'An account with this email already exists');

    const user = await User.create({
      websiteId,
      email,
      displayName: data.displayName.trim(),
      passwordHash: await hashPassword(data.password),
      avatarUrl: data.avatarUrl,
      role: USER_ROLES.USER,
    });

    const payload: AuthPayload = {
      userId: user._id.toString(),
      websiteId: user.websiteId.toString(),
      role: user.role,
      email: user.email,
    };

    const token = signToken(payload);
    await createSession(user._id.toString(), websiteId, token);

    return { user: toPublicUser(user), token, website: { name: website.name, branding: website.branding, settings: website.settings } };
  }

  static async updateProfile(userId: string, data: { displayName?: string; avatarUrl?: string }) {
    const user = await User.findById(userId);
    if (!user) throw new AppError(404, 'User not found');

    if (data.displayName?.trim()) user.displayName = data.displayName.trim();
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl || undefined;
    await user.save();

    return toPublicUser(user);
  }

  static async login(email: string, password: string, websiteId?: string) {
    const query: Record<string, unknown> = { email: email.toLowerCase() };
    if (websiteId) query.websiteId = websiteId;

    const user = await User.findOne(query);
    if (!user?.passwordHash) throw new AppError(401, 'Invalid credentials');

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials');
    if (user.isBlocked) throw new AppError(403, 'Account blocked');

    const payload: AuthPayload = {
      userId: user._id.toString(),
      websiteId: user.websiteId.toString(),
      role: user.role,
      email: user.email,
    };

    const token = signToken(payload);
    await createSession(user._id.toString(), user.websiteId.toString(), token);

    return { user: toPublicUser(user), token };
  }

  static async loginWithGoogle(websiteId: string, idToken: string) {
    const { OAuth2Client } = await import('google-auth-library');
    const { config } = await import('../config');

    if (!config.google.clientId) {
      throw new AppError(503, 'Google sign-in is not configured on the server');
    }

    const client = new OAuth2Client(config.google.clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new AppError(401, 'Invalid Google credentials');

    const website = await Website.findById(websiteId);
    if (!website?.isActive) throw new AppError(404, 'Website not found');

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const displayName = (payload.name || email.split('@')[0]).trim();
    const avatarUrl = payload.picture;

    let user = await User.findOne({
      websiteId,
      $or: [{ email }, { externalId: googleId }],
    });

    if (!user) {
      user = await User.create({
        websiteId,
        email,
        displayName,
        avatarUrl,
        externalId: googleId,
        role: USER_ROLES.USER,
      });
    } else {
      user.displayName = displayName;
      if (avatarUrl) user.avatarUrl = avatarUrl;
      if (!user.externalId) user.externalId = googleId;
      await user.save();
    }

    if (user.isBlocked) throw new AppError(403, 'Account blocked');

    const authPayload: AuthPayload = {
      userId: user._id.toString(),
      websiteId: user.websiteId.toString(),
      role: user.role,
      email: user.email,
    };

    const token = signToken(authPayload);
    await createSession(user._id.toString(), websiteId, token);

    return {
      user: toPublicUser(user),
      token,
      website: { name: website.name, branding: website.branding, settings: website.settings },
    };
  }

  static async adminLogin(email: string, password: string) {
    const user = await User.findOne({
      email: email.toLowerCase(),
      role: { $in: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN] },
    });
    if (!user?.passwordHash) throw new AppError(401, 'Invalid credentials');

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    const payload: AuthPayload = {
      userId: user._id.toString(),
      websiteId: user.websiteId.toString(),
      role: user.role,
      email: user.email,
    };

    const token = signToken(payload);
    await createSession(user._id.toString(), user.websiteId.toString(), token);

    return { user: toPublicUser(user), token };
  }

  static async logout(token: string) {
    const { Session } = await import('../models');
    await Session.updateOne({ token }, { isActive: false });
  }
}

export class WebsiteService {
  static async create(data: { name: string; domain: string; branding?: Record<string, unknown> }) {
    const website = await Website.create({
      tenantId: generateTenantId(),
      name: data.name,
      domain: data.domain,
      apiKey: generateApiKey(),
      isVerified: false,
      branding: data.branding || {},
    });
    return website;
  }

  static async list(page = 1, limit = 20) {
    const { skip, page: p, limit: l } = paginate(page, limit);
    const [data, total] = await Promise.all([
      Website.find().sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
      Website.countDocuments(),
    ]);
    return { data, page: p, limit: l, total, hasMore: skip + data.length < total };
  }

  static async getById(id: string) {
    const website = await Website.findById(id);
    if (!website) throw new AppError(404, 'Website not found');
    return website;
  }

  static async update(id: string, updates: Record<string, unknown>) {
    const website = await Website.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!website) throw new AppError(404, 'Website not found');
    return website;
  }

  static async verify(id: string) {
    return WebsiteService.update(id, { isVerified: true });
  }

  static async regenerateApiKey(id: string) {
    return WebsiteService.update(id, { apiKey: generateApiKey() });
  }

  static async getAnalytics(websiteId: string) {
    const websiteObjectId = new Types.ObjectId(websiteId);
    const [users, conversations, messages, onlineUsers] = await Promise.all([
      User.countDocuments({ websiteId }),
      Conversation.countDocuments({ websiteId }),
      Message.countDocuments({ websiteId, isDeleted: false }),
      User.countDocuments({ websiteId, isOnline: true }),
    ]);

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 6);
    last7Days.setHours(0, 0, 0, 0);

    const recentMessages = await Message.countDocuments({
      websiteId,
      createdAt: { $gte: last7Days },
      isDeleted: false,
    });

    const [messagesByDayRaw, signupsByDayRaw, usersByRoleRaw] = await Promise.all([
      Message.aggregate([
        { $match: { websiteId: websiteObjectId, isDeleted: false, createdAt: { $gte: last7Days } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $match: { websiteId: websiteObjectId, createdAt: { $gte: last7Days } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $match: { websiteId: websiteObjectId } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);

    const fillDays = (raw: { _id: string; count: number }[]) => {
      const map = new Map(raw.map((r) => [r._id, r.count]));
      const days: { date: string; label: string; count: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(last7Days);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        days.push({
          date: key,
          label: d.toLocaleDateString('en-US', { weekday: 'short' }),
          count: map.get(key) || 0,
        });
      }
      return days;
    };

    const roleLabels: Record<string, string> = {
      user: 'Users',
      moderator: 'Moderators',
      admin: 'Admins',
      super_admin: 'Super Admins',
    };

    return {
      users,
      conversations,
      messages,
      onlineUsers,
      recentMessages,
      charts: {
        messagesByDay: fillDays(messagesByDayRaw),
        signupsByDay: fillDays(signupsByDayRaw),
        usersByRole: usersByRoleRaw.map((r) => ({
          role: roleLabels[r._id] || r._id,
          count: r.count,
        })),
        activity: [
          { name: 'Users', value: users },
          { name: 'Conversations', value: conversations },
          { name: 'Messages', value: messages },
          { name: 'Online', value: onlineUsers },
        ],
      },
    };
  }
}

export class UserService {
  static async search(websiteId: string, query: string, excludeUserId: string, page = 1, limit = 20) {
    const { skip, page: p, limit: l } = paginate(page, limit);
    const filter = {
      websiteId,
      _id: { $ne: excludeUserId },
      isBlocked: false,
      $or: [
        { displayName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    };

    const [data, total] = await Promise.all([
      User.find(filter).select('-passwordHash').skip(skip).limit(l).lean(),
      User.countDocuments(filter),
    ]);

    return { data, page: p, limit: l, total, hasMore: skip + data.length < total };
  }

  static async listByWebsite(websiteId: string, page = 1, limit = 20) {
    const { skip, page: p, limit: l } = paginate(page, limit);
    const filter = { websiteId };
    const [data, total] = await Promise.all([
      User.find(filter).select('-passwordHash').skip(skip).limit(l).sort({ createdAt: -1 }).lean(),
      User.countDocuments(filter),
    ]);
    return { data, page: p, limit: l, total, hasMore: skip + data.length < total };
  }

  static async blockUser(userId: string, blocked: boolean) {
    const user = await User.findByIdAndUpdate(userId, { isBlocked: blocked }, { new: true });
    if (!user) throw new AppError(404, 'User not found');
    return toPublicUser(user);
  }

  static async updatePresence(userId: string, isOnline: boolean) {
    await User.findByIdAndUpdate(userId, {
      isOnline,
      lastSeenAt: isOnline ? undefined : new Date(),
    });
  }
}

export class ConversationService {
  static async getOrCreate(websiteId: string, userId: string, participantId: string) {
    if (userId === participantId) throw new AppError(400, 'Cannot message yourself');

    let conversation = await Conversation.findOne({
      websiteId,
      participants: { $all: [userId, participantId], $size: 2 },
    }).populate('participants', '-passwordHash');

    if (!conversation) {
      conversation = await Conversation.create({
        websiteId,
        participants: [userId, participantId],
        unreadCounts: new Map([
          [userId, 0],
          [participantId, 0],
        ]),
      });
      conversation = await conversation.populate('participants', '-passwordHash');
    }

    return conversation;
  }

  static async listForUser(websiteId: string, userId: string, page = 1, limit = 20) {
    const { skip, page: p, limit: l } = paginate(page, limit);
    const filter = { websiteId, participants: userId };

    const [data, total] = await Promise.all([
      Conversation.find(filter)
        .populate('participants', '-passwordHash')
        .populate({
          path: 'lastMessage',
          populate: { path: 'senderId', select: 'displayName avatarUrl' },
        })
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(l)
        .lean(),
      Conversation.countDocuments(filter),
    ]);

    return { data, page: p, limit: l, total, hasMore: skip + data.length < total };
  }

  static async search(websiteId: string, userId: string, query: string) {
    const conversations = await Conversation.find({
      websiteId,
      participants: userId,
    }).populate('participants', '-passwordHash');

    const lowerQuery = query.toLowerCase();
    return conversations.filter((c) =>
      (c.participants as unknown as { displayName: string; _id: { toString(): string } }[]).some(
        (p) => p._id.toString() !== userId && p.displayName.toLowerCase().includes(lowerQuery)
      )
    );
  }

  static async getUnreadTotal(userId: string) {
    const conversations = await Conversation.find({ participants: userId });
    return conversations.reduce((sum, c) => sum + (c.unreadCounts.get(userId) || 0), 0);
  }
}

export class MessageService {
  static async list(conversationId: string, userId: string, page = 1, limit = 30) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new AppError(404, 'Conversation not found');
    if (!conversation.participants.some((p) => p.toString() === userId)) {
      throw new AppError(403, 'Not a participant');
    }

    const { skip, page: p, limit: l } = paginate(page, limit);
    const filter = { conversationId, isDeleted: false };

    const [data, total] = await Promise.all([
      Message.find(filter)
        .populate('senderId', 'displayName avatarUrl isOnline')
        .populate('replyTo')
        .populate('attachments')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(l)
        .lean(),
      Message.countDocuments(filter),
    ]);

    return { data: data.reverse(), page: p, limit: l, total, hasMore: skip + data.length < total };
  }

  static async send(
    websiteId: string,
    conversationId: string,
    senderId: string,
    content: string,
    replyTo?: string,
    attachmentIds?: string[]
  ) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new AppError(404, 'Conversation not found');
    if (!conversation.participants.some((p) => p.toString() === senderId)) {
      throw new AppError(403, 'Not a participant');
    }

    const message = await Message.create({
      websiteId,
      conversationId,
      senderId,
      content,
      replyTo,
      attachments: attachmentIds || [],
      status: MESSAGE_STATUS.SENT,
      readBy: [senderId],
    });

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();

    for (const participantId of conversation.participants) {
      const pid = participantId.toString();
      if (pid !== senderId) {
        const current = conversation.unreadCounts.get(pid) || 0;
        conversation.unreadCounts.set(pid, current + 1);

        await Notification.create({
          websiteId,
          userId: participantId,
          type: 'new_message',
          title: 'New message',
          body: content.startsWith('__QC_E2E__') ? 'You received an encrypted message' : content.slice(0, 100) || 'Sent an attachment',
          data: { conversationId, messageId: message._id.toString() },
        });
      }
    }

    await conversation.save();

    return Message.findById(message._id)
      .populate('senderId', 'displayName avatarUrl isOnline')
      .populate('replyTo')
      .populate('attachments');
  }

  static async edit(messageId: string, userId: string, content: string) {
    const message = await Message.findById(messageId);
    if (!message) throw new AppError(404, 'Message not found');
    if (message.senderId.toString() !== userId) throw new AppError(403, 'Cannot edit this message');
    if (message.isDeleted) throw new AppError(400, 'Message deleted');

    message.content = content;
    message.isEdited = true;
    await message.save();

    return Message.findById(messageId)
      .populate('senderId', 'displayName avatarUrl')
      .populate('attachments');
  }

  static async delete(messageId: string, userId: string, _role: string) {
    const message = await Message.findById(messageId);
    if (!message) throw new AppError(404, 'Message not found');

    // Only the sender may delete their own message — admins cannot access personal content
    if (message.senderId.toString() !== userId) {
      throw new AppError(403, 'Cannot delete this message');
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = '';
    await message.save();
    return message;
  }

  static async react(messageId: string, userId: string, emoji: string) {
    const message = await Message.findById(messageId);
    if (!message) throw new AppError(404, 'Message not found');

    const existingIdx = message.reactions.findIndex(
      (r) => r.userId.toString() === userId && r.emoji === emoji
    );

    if (existingIdx >= 0) {
      message.reactions.splice(existingIdx, 1);
    } else {
      message.reactions.push({ emoji, userId: new Types.ObjectId(userId) });
    }

    await message.save();
    return message;
  }

  static async markRead(conversationId: string, userId: string, messageIds?: string[]) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new AppError(404, 'Conversation not found');

    const filter: Record<string, unknown> = {
      conversationId,
      senderId: { $ne: userId },
      readBy: { $ne: userId },
    };
    if (messageIds?.length) filter._id = { $in: messageIds };

    await Message.updateMany(filter, {
      $addToSet: { readBy: userId },
      $set: { status: MESSAGE_STATUS.READ },
    });

    conversation.unreadCounts.set(userId, 0);
    await conversation.save();

    return { conversationId, userId };
  }

}

export class AttachmentService {
  static async create(
    websiteId: string,
    uploaderId: string,
    file: Express.Multer.File,
    baseUrl: string,
    encryption?: {
      isEncrypted?: boolean;
      encryptionIv?: string;
      originalMimeType?: string;
      encryptedOriginalName?: string;
    }
  ) {
    const isEncrypted = encryption?.isEncrypted === true;
    const attachment = await Attachment.create({
      websiteId,
      uploaderId,
      filename: file.filename,
      originalName: isEncrypted ? 'encrypted.bin' : file.originalname,
      mimeType: isEncrypted ? 'application/octet-stream' : file.mimetype,
      size: file.size,
      url: `${baseUrl}/uploads/${file.filename}`,
      isEncrypted,
      encryptionIv: encryption?.encryptionIv,
      originalMimeType: encryption?.originalMimeType,
      encryptedOriginalName: encryption?.encryptedOriginalName,
    });
    return attachment;
  }
}

export class NotificationService {
  static async list(userId: string, page = 1, limit = 20) {
    const { skip, page: p, limit: l } = paginate(page, limit);
    const [data, total] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
      Notification.countDocuments({ userId }),
    ]);
    return { data, page: p, limit: l, total, hasMore: skip + data.length < total };
  }

  static async markRead(notificationId: string, userId: string) {
    await Notification.findOneAndUpdate({ _id: notificationId, userId }, { isRead: true });
  }

  static async markAllRead(userId: string) {
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  }
}
