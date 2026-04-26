require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const path = require('path');

const app = express();
const publicDir = path.join(__dirname, 'client', 'dist');
app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));


// Auto-pause rules time window check (Vietnam time, UTC+7)
function isWithinAutoRuleTimeWindow(startTime, endTime) {
  const now = new Date();
  const vnOffset = 7 * 60; // minutes
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const vnMinutes = (utcMinutes + vnOffset) % (24 * 60);

  const [sh, sm] = (startTime || '00:00').split(':').map(Number);
  const [eh, em] = (endTime || '08:30').split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  if (startMin <= endMin) {
    return vnMinutes >= startMin && vnMinutes < endMin;
  } else {
    // Overnight range, e.g. 22:00 - 06:00
    return vnMinutes >= startMin || vnMinutes < endMin;
  }
}



const AccountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  fbToken: { type: String, default: '' },
  adAccountId: { type: String, required: true },
  claudeKey: { type: String, default: '' },
  spendThreshold: { type: Number, default: 20000 },
  checkInterval: { type: Number, default: 60 },
  autoEnabled: { type: Boolean, default: false },
  status: { type: String, enum: ['connected', 'error', 'disconnected'], default: 'disconnected' },
  lastChecked: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const ConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  fbToken: { type: String, default: '' },
  fbTokenExpiresAt: { type: Date },
  fbTokenLastRefreshTime: { type: Date },
  fbTokenLastDebugTime: { type: Date },
  fbTokenLastRefreshError: { type: String, default: '' },
  claudeKey: { type: String, default: '' },
  fbAppId: { type: String, default: '' },
  fbAppSecret: { type: String, default: '' },
  pancakeApiKey: { type: String, default: '' },
  pancakeShopId: { type: String, default: '' },
  autoRuleStartTime: { type: String, default: '00:00' },
  autoRuleEndTime: { type: String, default: '08:30' },
  
  dailyZeroMessageSpendLimit: { type: Number, default: 25000 },
  dailyHighCostPerMessageLimit: { type: Number, default: 20000 },
  dailyHighCostSpendLimit: { type: Number, default: 50000 },
  
  lifetimeZeroMessageSpendLimit: { type: Number, default: 25000 },
  lifetimeHighCostPerMessageLimit: { type: Number, default: 20000 },
  lifetimeHighCostSpendLimit: { type: Number, default: 50000 },

  updatedAt: { type: Date, default: Date.now }
});

const FacebookTokenSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'facebook_user' },
  appId: { type: String, default: '' },
  appSecret: { type: String, default: '' },
  token: { type: String, required: true },
  expires_at: { type: Date },
  last_refresh_time: { type: Date },
  last_debug_time: { type: Date },
  last_error: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const CampaignSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  campaignId: { type: String, required: true },
  name: { type: String },
  status: { type: String },
  dailyBudget: { type: Number, default: 0 },
  lifetimeBudget: { type: Number, default: 0 },
  budgetType: { type: String, default: 'DAILY' },
  spend: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  messages: { type: Number, default: 0 },
  costPerMessage: { type: Number, default: 0 },
  date: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
}, { autoIndex: false });

CampaignSchema.index(
  { accountId: 1, campaignId: 1, date: 1 },
  {
    unique: true,
    name: 'campaign_daily_unique',
    partialFilterExpression: { date: { $type: 'string' } }
  }
);
CampaignSchema.index({ date: 1, spend: -1 }, { name: 'campaign_date_spend' });
CampaignSchema.index({ accountId: 1, date: 1, spend: -1 }, { name: 'campaign_account_date_spend' });

const LogSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  accountName: { type: String },
  level: { type: String, enum: ['info', 'success', 'warn', 'error', 'ai'], default: 'info' },
  message: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  status: { type: String },
  customerName: { type: String },
  totalPrice: { type: Number },
  rawData: { type: Object }, // Lưu toàn bộ payload từ webhook
  createdAt: { type: Date, default: Date.now }
});
OrderSchema.index({ createdAt: -1 }, { name: 'order_createdAt_desc' });
OrderSchema.index({ status: 1, createdAt: -1 }, { name: 'order_status_createdAt' });

const FacebookPostSchema = new mongoose.Schema({
  postId: { type: String, required: true, unique: true },
  pageId: { type: String, index: true },
  pageName: { type: String },
  pageAvatar: { type: String },
  message: { type: String, default: '' },
  createdTime: { type: Date },
  permalink: { type: String },
  picture: { type: String },
  shares: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  rawData: { type: Object },
  fetchedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
FacebookPostSchema.index({ pageId: 1, createdTime: -1 });
FacebookPostSchema.index({ createdTime: -1, fetchedAt: -1 }, { name: 'post_created_fetched_desc' });

const Account = mongoose.model('Account', AccountSchema);
const Campaign = mongoose.model('Campaign', CampaignSchema);
const Log = mongoose.model('Log', LogSchema);
const Config = mongoose.model('Config', ConfigSchema);
const FacebookToken = mongoose.model('FacebookToken', FacebookTokenSchema);
const Order = mongoose.model('Order', OrderSchema);
const FacebookPost = mongoose.model('FacebookPost', FacebookPostSchema);

const DEFAULT_CAMPAIGN_DAILY_BUDGET = 300000;
const DEFAULT_AD_SET_NAME = 'Nh\u00f3m qu\u1ea3ng c\u00e1o L\u01b0\u1ee3t mua m\u1edbi';
const DEFAULT_AD_NAME_PREFIX = 'PHAT';
const DEFAULT_POST_LABEL_PREFIX = 'MS';
const DEFAULT_CAMPAIGN_OBJECTIVE = 'OUTCOME_SALES';
const DEFAULT_AD_SET_DESTINATION_TYPE = 'MESSENGER';
const DEFAULT_AD_SET_OPTIMIZATION_GOAL = 'MESSAGING_PURCHASE_CONVERSION';
const META_POST_REQUEST_LIMIT = 100;
const POSTS_PER_PAGE_LIMIT = 150;
const FACEBOOK_TOKEN_KEY = 'facebook_user';
const FACEBOOK_TOKEN_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const FACEBOOK_TOKEN_MAX_ATTEMPTS = 3;
const FACEBOOK_TOKEN_CRON = process.env.FACEBOOK_TOKEN_CRON || '0 */6 * * *';
const TOKEN_ALERT_WEBHOOK_URL = process.env.TOKEN_ALERT_WEBHOOK_URL || '';

async function addLog(accountId, accountName, level, message) {
  try {
    await Log.create({ accountId, accountName, level, message });
  } catch {}
}

async function getAppConfig() {
  return Config.findOne({ key: 'app' });
}

async function getEffectiveSecrets(account) {
  const config = await getAppConfig();
  let fbToken = account.fbToken || config?.fbToken || '';
  let claudeKey = account.claudeKey || config?.claudeKey || '';
  return { fbToken, claudeKey };
}

function normalizeAdAccountId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const numericId = raw.replace(/^act_/i, '');
  if (!/^\d+$/.test(numericId)) return raw;

  return `act_${numericId}`;
}

function isValidAdAccountId(value) {
  return /^act_\d+$/.test(String(value || '').trim());
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCodeList(value) {
  const source = Array.isArray(value) ? value.join('\n') : String(value || '');
  return [...new Set(
    source
      .split(/[\n,;|]+/)
      .map(item => item.trim())
      .filter(Boolean)
  )];
}

function buildCampaignName(code, prefix = '') {
  const cleanCode = String(code || '').replace(/\s+/g, ' ').trim();
  const cleanPrefix = String(prefix || '').replace(/\s+/g, ' ').trim();
  return cleanPrefix ? `${cleanPrefix} ${cleanCode}` : cleanCode;
}

function getPostPageId(post = {}) {
  const pageId = String(post.pageId || '').trim();
  if (pageId) return pageId;

  const postId = String(post.postId || '').trim();
  if (postId.includes('_')) return postId.split('_')[0];
  return '';
}

function buildAdName(code, prefix = DEFAULT_AD_NAME_PREFIX) {
  const cleanCode = String(code || '').replace(/\s+/g, ' ').trim();
  const productLabel = `${DEFAULT_POST_LABEL_PREFIX} ${cleanCode}`;
  return `${String(prefix || DEFAULT_AD_NAME_PREFIX).trim()}__${productLabel}__Test`;
}

async function buildAccountPayload(input = {}) {
  const config = await getAppConfig();
  return {
    name: String(input.name || '').trim(),
    fbToken: String(input.fbToken || config?.fbToken || '').trim(),
    adAccountId: normalizeAdAccountId(input.adAccountId),
    claudeKey: String(input.claudeKey || config?.claudeKey || '').trim(),
    spendThreshold: Number(input.spendThreshold || 20000),
    checkInterval: Number(input.checkInterval || 60),
    autoEnabled: Boolean(input.autoEnabled)
  };
}

function todayStr() {
  const d = new Date();
  const vnTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().split('T')[0];
}

function normalizeCampaignDate(value) {
  const date = String(value || '').trim();
  return date || todayStr();
}

function buildOrderQuery({ fromDate, toDate } = {}) {
  const query = {
    status: { $nin: ['5', 'cancelled', 'deleted'] },
    'rawData.is_deleted': { $ne: true }
  };

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      const d = new Date(`${fromDate}T00:00:00Z`);
      query.createdAt.$gte = new Date(d.getTime() - 7 * 60 * 60 * 1000);
    }
    if (toDate) {
      const d = new Date(`${toDate}T23:59:59Z`);
      query.createdAt.$lte = new Date(d.getTime() - 7 * 60 * 60 * 1000);
    }
  }

  return query;
}

function getOrderItemsFromRaw(raw = {}) {
  return [raw.items, raw.line_items, raw.products, raw.details].find(Array.isArray) || [];
}

function getOrderItemSku(item = {}) {
  const variationInfo = item.variation_info || {};
  return variationInfo.product_display_id ||
    variationInfo.display_id ||
    item.sku ||
    item.item_code ||
    '';
}

function normalizeSkuKey(value) {
  return String(value || '').trim().toUpperCase();
}

async function upsertDailyCampaign(accountId, campaignId, date, fields = {}) {
  const dailyDate = normalizeCampaignDate(date);
  const normalizedCampaignId = String(campaignId || '').trim();
  if (!accountId || !normalizedCampaignId) {
    throw new Error('Thieu accountId hoac campaignId khi luu camp');
  }

  const updateFields = { ...fields };
  delete updateFields.accountId;
  delete updateFields.campaignId;
  delete updateFields.date;

  const filter = { accountId, campaignId: normalizedCampaignId, date: dailyDate };
  const update = {
    $set: {
      ...updateFields,
      date: dailyDate,
      updatedAt: new Date()
    },
    $setOnInsert: {
      accountId,
      campaignId: normalizedCampaignId
    }
  };

  try {
    return await Campaign.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch (error) {
    if (error?.code === 11000) {
      return Campaign.findOneAndUpdate(filter, update, { new: true });
    }
    throw error;
  }
}

function buildVietnamCampaignStart(year, month, day, hour, minute) {
  const localDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const yyyy = localDate.getUTCFullYear();
  const mm = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(localDate.getUTCDate()).padStart(2, '0');
  const hh = String(localDate.getUTCHours()).padStart(2, '0');
  const mi = String(localDate.getUTCMinutes()).padStart(2, '0');
  const startUtc = new Date(Date.UTC(yyyy, localDate.getUTCMonth(), localDate.getUTCDate(), localDate.getUTCHours() - 7, localDate.getUTCMinutes(), 0));

  return {
    fbStartTime: `${yyyy}-${mm}-${dd}T${hh}:${mi}:00+0700`,
    utc: startUtc.toISOString(),
    display: `${dd}/${mm}/${yyyy} ${hh}:${mi}`
  };
}

function getTomorrowVietnamCampaignStart() {
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return buildVietnamCampaignStart(
    vnNow.getUTCFullYear(),
    vnNow.getUTCMonth() + 1,
    vnNow.getUTCDate() + 1,
    6,
    1
  );
}

function parseVietnamCampaignStart(value) {
  const raw = String(value || '').trim();
  if (!raw) return getTomorrowVietnamCampaignStart();

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error('Thoi gian bat dau khong hop le. Dung dang YYYY-MM-DDTHH:mm');
  }

  const [, year, month, day, hour, minute] = match.map(Number);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59 ||
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() + 1 !== month ||
    dateCheck.getUTCDate() !== day
  ) {
    throw new Error('Thoi gian bat dau khong hop le. Dung dang YYYY-MM-DDTHH:mm');
  }

  const scheduledStart = buildVietnamCampaignStart(year, month, day, hour, minute);
  if (new Date(scheduledStart.utc).getTime() < Date.now() - 60 * 1000) {
    throw new Error('Thoi gian bat dau phai la hien tai hoac tuong lai');
  }

  return scheduledStart;
}

function parseCampaignAgeRange(ageMinValue, ageMaxValue) {
  const ageMin = parseBoundedInt(ageMinValue, 22, 13, 65);
  const ageMax = parseBoundedInt(ageMaxValue, 47, 13, 65);
  if (ageMin > ageMax) {
    throw new Error('Tuoi tu phai nho hon hoac bang tuoi den');
  }
  return { ageMin, ageMax };
}

async function exchangeToken(shortToken, appId, appSecret) {
  try {
    const response = await axios.get('https://graph.facebook.com/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken
      }
    });
    return response.data.access_token;
  } catch (error) {
    throw new Error(`Khong the doi token: ${error.response?.data?.error?.message || error.message}`);
  }
}

const FB_TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);
const FB_TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientFbResponse(status, data) {
  const code = Number(data?.error?.code);
  const subcode = Number(data?.error?.error_subcode);
  return FB_TRANSIENT_STATUSES.has(Number(status)) || FB_TRANSIENT_CODES.has(code) || subcode === 99;
}

function buildFbRequestError(method, status, data, fallbackMessage) {
  const message = data?.error?.message || fallbackMessage;
  if (Number(status) === 400 && Number(data?.error?.code) === 190) {
    const tokenError = new Error(`Token het han hoac khong hop le: ${message}`);
    tokenError.status = status;
    tokenError.fbData = data;
    tokenError.transient = false;
    return tokenError;
  }

  const error = new Error(`FB ${method} ${status || 'ERR'}: ${JSON.stringify(data) || fallbackMessage}`);
  error.status = status;
  error.fbData = data;
  error.transient = isTransientFbResponse(status, data);
  return error;
}

async function fbGet(token, resourcePath, params = {}, options = {}) {
  const retries = Number.isFinite(options.retries) ? options.retries : 2;
  const url = `https://graph.facebook.com/v19.0/${resourcePath}`;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, { params: { access_token: token, ...params } });
      return response.data;
    } catch (error) {
      lastError = buildFbRequestError('GET', error.response?.status, error.response?.data, error.message);
      if (!lastError.transient || attempt === retries) break;
      await sleep(350 * (attempt + 1));
    }
  }

  throw lastError;
}

async function fbPost(token, resourcePath, body = {}, options = {}) {
  const retries = Number.isFinite(options.retries) ? options.retries : 2;
  const url = `https://graph.facebook.com/v19.0/${resourcePath}`;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(url, { access_token: token, ...body });
      return response.data;
    } catch (error) {
      lastError = buildFbRequestError('POST', error.response?.status, error.response?.data, error.message);
      if (!lastError.transient || attempt === retries) break;
      await sleep(350 * (attempt + 1));
    }
  }

  throw lastError;
}

function maskToken(token = '') {
  const value = String(token || '');
  if (value.length <= 14) return value ? `${value.slice(0, 3)}...` : '';
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function parseFacebookExpiresAt(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

function getDaysUntil(date) {
  if (!date) return null;
  return (date.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
}

async function retryOperation(label, operation, attempts = FACEBOOK_TOKEN_MAX_ATTEMPTS) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const status = Number(error.response?.status || error.status || 0);
      const retryable = error.retryable !== false && (!status || status === 429 || status >= 500);
      const waitMs = 1000 * attempt;
      console.warn(`${label} failed (${attempt}/${attempts}): ${error.message}`);
      if (!retryable || attempt >= attempts) break;
      await sleep(waitMs);
    }
  }
  throw lastError;
}

function getAxiosApiErrorMessage(error) {
  const status = error.response?.status || error.status || 'ERR';
  const apiError = error.response?.data?.error;
  if (apiError) {
    const parts = [
      apiError.message,
      apiError.code ? `code=${apiError.code}` : '',
      apiError.error_subcode ? `subcode=${apiError.error_subcode}` : '',
      apiError.fbtrace_id ? `fbtrace_id=${apiError.fbtrace_id}` : ''
    ].filter(Boolean);
    return `${status}: ${parts.join(', ')}`;
  }
  return `${status}: ${error.message}`;
}

function createFacebookApiError(action, error) {
  const apiError = new Error(`${action} failed: ${getAxiosApiErrorMessage(error)}`);
  const status = Number(error.response?.status || error.status || 0);
  apiError.status = status;
  apiError.retryable = status === 429 || status >= 500 || !status;
  return apiError;
}

async function sendTokenAlert(message, meta = {}) {
  console.error(`TOKEN ALERT: ${message}`, meta);
  if (!TOKEN_ALERT_WEBHOOK_URL) return;

  try {
    await axios.post(TOKEN_ALERT_WEBHOOK_URL, {
      text: message,
      meta,
      time: new Date().toISOString()
    }, { timeout: 10000 });
  } catch (error) {
    console.error(`Token alert webhook failed: ${error.message}`);
  }
}

async function debugFacebookToken(appId, appSecret, token) {
  let response;
  try {
    response = await axios.get('https://graph.facebook.com/debug_token', {
      params: {
        input_token: token,
        access_token: `${appId}|${appSecret}`
      },
      timeout: 15000
    });
  } catch (error) {
    throw createFacebookApiError('Facebook debug_token', error);
  }

  const data = response.data?.data || {};
  if (!data.is_valid) {
    const error = new Error(`Facebook token invalid: ${data.error?.message || data.error?.code || 'unknown reason'}`);
    error.retryable = false;
    throw error;
  }
  return data;
}

async function exchangeFacebookUserToken(appId, appSecret, currentToken) {
  let response;
  try {
    response = await axios.get('https://graph.facebook.com/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: currentToken
      },
      timeout: 15000
    });
  } catch (error) {
    throw createFacebookApiError('Facebook token exchange', error);
  }

  if (!response.data?.access_token) {
    const error = new Error('Facebook exchange response missing access_token');
    error.retryable = false;
    throw error;
  }
  return response.data;
}

async function saveFacebookTokenState({ appId, appSecret, token, expiresAt, refreshedAt = null, lastError = '' }) {
  const now = new Date();
  const update = {
    appId,
    appSecret,
    token,
    expires_at: expiresAt || null,
    last_debug_time: now,
    last_error: lastError,
    updatedAt: now
  };
  if (refreshedAt) update.last_refresh_time = refreshedAt;

  const tokenState = await FacebookToken.findOneAndUpdate(
    { key: FACEBOOK_TOKEN_KEY },
    { $set: update, $setOnInsert: { key: FACEBOOK_TOKEN_KEY, createdAt: now } },
    { upsert: true, new: true }
  );

  const configUpdate = {
    fbAppId: appId,
    fbAppSecret: appSecret,
    fbToken: token,
    fbTokenExpiresAt: expiresAt || null,
    fbTokenLastDebugTime: now,
    fbTokenLastRefreshError: lastError,
    updatedAt: now
  };
  if (refreshedAt) configUpdate.fbTokenLastRefreshTime = refreshedAt;

  await Config.findOneAndUpdate(
    { key: 'app' },
    { $set: configUpdate, $setOnInsert: { key: 'app' } },
    { upsert: true }
  );

  return tokenState;
}

async function resolveFacebookTokenInput() {
  const [tokenState, config] = await Promise.all([
    FacebookToken.findOne({ key: FACEBOOK_TOKEN_KEY }),
    getAppConfig()
  ]);

  return {
    tokenState,
    appId: String(tokenState?.appId || config?.fbAppId || process.env.FB_APP_ID || '').trim(),
    appSecret: String(tokenState?.appSecret || config?.fbAppSecret || process.env.FB_APP_SECRET || '').trim(),
    token: String(tokenState?.token || config?.fbToken || process.env.FB_LONG_LIVED_USER_ACCESS_TOKEN || '').trim()
  };
}

async function configureFacebookToken({ app_id, app_secret, long_lived_user_access_token }) {
  const appId = String(app_id || '').trim();
  const appSecret = String(app_secret || '').trim();
  const token = String(long_lived_user_access_token || '').trim();

  if (!appId || !appSecret || !token) {
    throw new Error('Missing app_id, app_secret, or long_lived_user_access_token');
  }

  const debugData = await retryOperation('debug Facebook token', () => debugFacebookToken(appId, appSecret, token));
  const expiresAt = parseFacebookExpiresAt(debugData.expires_at);
  return saveFacebookTokenState({ appId, appSecret, token, expiresAt });
}

async function checkAndRefreshFacebookToken({ force = false, source = 'manual' } = {}) {
  const { appId, appSecret, token } = await resolveFacebookTokenInput();
  if (!appId || !appSecret || !token) {
    return { ok: false, skipped: true, reason: 'missing_config' };
  }

  try {
    const debugData = await retryOperation('debug Facebook token', () => debugFacebookToken(appId, appSecret, token));
    const expiresAt = parseFacebookExpiresAt(debugData.expires_at);
    await saveFacebookTokenState({ appId, appSecret, token, expiresAt });

    const msLeft = expiresAt ? expiresAt.getTime() - Date.now() : Number.POSITIVE_INFINITY;
    if (!force && msLeft >= FACEBOOK_TOKEN_REFRESH_THRESHOLD_MS) {
      return {
        ok: true,
        refreshed: false,
        source,
        expires_at: expiresAt,
        days_left: getDaysUntil(expiresAt)
      };
    }

    const oldToken = token;
    const exchangeData = await retryOperation('exchange Facebook token', () =>
      exchangeFacebookUserToken(appId, appSecret, oldToken)
    );
    const newToken = exchangeData.access_token;

    let newExpiresAt = exchangeData.expires_in
      ? new Date(Date.now() + Number(exchangeData.expires_in) * 1000)
      : null;
    try {
      const newDebugData = await retryOperation('debug refreshed Facebook token', () =>
        debugFacebookToken(appId, appSecret, newToken)
      );
      newExpiresAt = parseFacebookExpiresAt(newDebugData.expires_at) || newExpiresAt;
    } catch (error) {
      await sendTokenAlert('Refreshed Facebook token but debug_token failed', { source, error: error.message });
    }

    const refreshedAt = new Date();
    await saveFacebookTokenState({ appId, appSecret, token: newToken, expiresAt: newExpiresAt, refreshedAt });

    console.log(
      `[${refreshedAt.toISOString()}] Facebook token refreshed (${source}): ${maskToken(oldToken)} -> ${maskToken(newToken)}; expires_at=${newExpiresAt?.toISOString() || 'unknown'}`
    );

    return {
      ok: true,
      refreshed: true,
      source,
      old_token: maskToken(oldToken),
      new_token: maskToken(newToken),
      expires_at: newExpiresAt,
      last_refresh_time: refreshedAt
    };
  } catch (error) {
    await FacebookToken.findOneAndUpdate(
      { key: FACEBOOK_TOKEN_KEY },
      { $set: { last_error: error.message, updatedAt: new Date() } }
    );
    await Config.findOneAndUpdate(
      { key: 'app' },
      { $set: { fbTokenLastRefreshError: error.message, updatedAt: new Date() } }
    );
    await sendTokenAlert('Facebook token refresh failed', { source, error: error.message });
    throw error;
  }
}

async function bootstrapFacebookTokenFromEnv() {
  const envInput = {
    app_id: process.env.FB_APP_ID,
    app_secret: process.env.FB_APP_SECRET,
    long_lived_user_access_token: process.env.FB_LONG_LIVED_USER_ACCESS_TOKEN
  };
  if (!envInput.app_id || !envInput.app_secret || !envInput.long_lived_user_access_token) return;

  const existing = await FacebookToken.findOne({ key: FACEBOOK_TOKEN_KEY });
  if (existing?.token) return;

  await configureFacebookToken(envInput);
  console.log(`Facebook token configured from environment: ${maskToken(envInput.long_lived_user_access_token)}`);
}

function startFacebookTokenCron() {
  if (!cron.validate(FACEBOOK_TOKEN_CRON)) {
    console.warn(`Invalid FACEBOOK_TOKEN_CRON "${FACEBOOK_TOKEN_CRON}", token cron disabled`);
    return null;
  }

  const task = cron.schedule(FACEBOOK_TOKEN_CRON, async () => {
    try {
      const result = await checkAndRefreshFacebookToken({ source: 'cron' });
      if (result.skipped) {
        console.warn(`Facebook token cron skipped: ${result.reason}`);
      }
    } catch (error) {
      console.error(`Facebook token cron failed: ${error.message}`);
    }
  });

  console.log(`Facebook token cron scheduled: ${FACEBOOK_TOKEN_CRON}`);
  return task;
}

function getPauseReason(spend, messages, costPerMessage, limits, budgetType) {
  const isDaily = budgetType === 'DAILY';
  const limitZero = isDaily ? limits.dailyZeroMessageSpendLimit : limits.lifetimeZeroMessageSpendLimit;
  const limitHighCostPerMsg = isDaily ? limits.dailyHighCostPerMessageLimit : limits.lifetimeHighCostPerMessageLimit;
  const limitHighCostSpend = isDaily ? limits.dailyHighCostSpendLimit : limits.lifetimeHighCostSpendLimit;

  if (messages <= 0 && spend >= limitZero) {
    return `Khong co tin nhan va da tieu tu ${limitZero.toLocaleString()}d`;
  }

  if (
    messages > 0 &&
    costPerMessage >= limitHighCostPerMsg &&
    spend >= limitHighCostSpend
  ) {
    return `Chi phi moi tin nhan tu ${limitHighCostPerMsg.toLocaleString()}d va da tieu tu ${limitHighCostSpend.toLocaleString()}d`;
  }

  return null;
}

function getCampaignMessageStats(campaign) {
  const spend = parseFloat(campaign.insights?.data?.[0]?.spend || 0);
  const actions = campaign.insights?.data?.[0]?.actions || [];
  const msgAction = actions.find(action =>
    action.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
    action.action_type === 'onsite_conversion.total_messaging_connection' ||
    action.action_type === 'omni_initiated_conversation'
  );
  const messages = parseInt(msgAction?.value || 0, 10);
  const costPerMessage = messages > 0 ? spend / messages : 0;

  return { spend, messages, costPerMessage };
}

async function fetchAccountData(account) {
  const today = todayStr();
  const { fbToken } = await getEffectiveSecrets(account);
  if (!fbToken) throw new Error('Thieu Facebook Access Token');

  const acctId = account.adAccountId.startsWith('act_')
    ? account.adAccountId
    : `act_${account.adAccountId}`;

  const data = await fbGet(fbToken, `${acctId}/campaigns`, {
    fields: 'id,name,status,daily_budget,lifetime_budget,insights.date_preset(today){spend,impressions,clicks,actions,cost_per_action_type}',
    limit: 50,
    date_preset: 'today'
  });

  const campaigns = data.data || [];
  let totalMessages = 0;

  for (const campaign of campaigns) {
    const insights = campaign.insights?.data?.[0] || {};
    const impressions = parseInt(insights.impressions || 0, 10);
    const clicks = parseInt(insights.clicks || 0, 10);
    const { spend, messages, costPerMessage } = getCampaignMessageStats(campaign);

    const isLifetime = !!campaign.lifetime_budget && parseFloat(campaign.lifetime_budget) > 0;
    const budgetType = isLifetime ? 'LIFETIME' : 'DAILY';
    const dailyBudget = parseFloat(campaign.daily_budget || 0); // Removed division by 100 to match earlier code logic if it was in VND, or let's keep it as is if it was doing / 100. Wait, FB API in VND usually requires no division. The original code had / 100.
    const lifetimeBudget = parseFloat(campaign.lifetime_budget || 0);

    totalMessages += messages;

    await upsertDailyCampaign(account._id, campaign.id, today, {
      name: campaign.name,
      status: campaign.status,
      dailyBudget: isLifetime ? 0 : dailyBudget,
      lifetimeBudget: isLifetime ? lifetimeBudget : 0,
      budgetType,
      spend,
      impressions,
      clicks,
      messages,
      costPerMessage
    });
  }

  let unreadMessages = 0;
  try {
    const conversations = await fbGet(fbToken, 'me/conversations', {
      fields: 'unread_count',
      limit: 50
    });
    unreadMessages = (conversations.data || []).reduce((sum, item) => sum + (item.unread_count || 0), 0);
  } catch {}

  const totalSpend = campaigns.reduce((sum, campaign) => {
    return sum + parseFloat(campaign.insights?.data?.[0]?.spend || 0);
  }, 0);

  return { campaigns, totalSpend, totalMessages, unreadMessages };
}

async function runAutoControl(account) {
  try {
    const { campaigns, totalSpend, totalMessages, unreadMessages } = await fetchAccountData(account);
    const { fbToken, claudeKey } = await getEffectiveSecrets(account);

    await Account.findByIdAndUpdate(account._id, {
      lastChecked: new Date(),
      status: 'connected'
    });

    await addLog(
      account._id,
      account.name,
      'info',
      `Kiem tra: chi tieu ${totalSpend.toLocaleString()}d · tin nhan camp: ${totalMessages} · inbox moi: ${unreadMessages}`
    );

    const config = await getAppConfig();
    const ruleStart = config?.autoRuleStartTime || '00:00';
    const ruleEnd = config?.autoRuleEndTime || '08:30';

    let campaignsToPause = [];
    if (isWithinAutoRuleTimeWindow(ruleStart, ruleEnd)) {
      campaignsToPause = campaigns
        .filter(campaign => campaign.status === 'ACTIVE')
        .map(campaign => {
          const { spend, messages, costPerMessage } = getCampaignMessageStats(campaign);
          const isLifetime = !!campaign.lifetime_budget && parseFloat(campaign.lifetime_budget) > 0;
          const budgetType = isLifetime ? 'LIFETIME' : 'DAILY';
          const pauseReason = getPauseReason(spend, messages, costPerMessage, config, budgetType);
          return pauseReason ? { campaign, spend, messages, costPerMessage, pauseReason } : null;
        })
        .filter(Boolean);
    } else {
      await addLog(
        account._id,
        account.name,
        'info',
        `Ngoai khung gio auto-rule (${ruleStart}-${ruleEnd}), chi theo doi khong tat camp`
      );
    }

    if (claudeKey) {
      try {
        const today = todayStr();
        const todayCampaigns = await Campaign.find({ accountId: account._id, date: today });
        const totalMsg = todayCampaigns.reduce((sum, campaign) => sum + campaign.messages, 0);
        const avgCPM = totalMsg > 0 ? totalSpend / totalMsg : 0;

        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 200,
            messages: [{
              role: 'user',
              content: `Tai khoan "${account.name}": chi tieu ${totalSpend.toLocaleString()}d, tin nhan inbox: ${unreadMessages}, tong tin nhan camp: ${totalMsg}, CPM trung binh: ${avgCPM.toFixed(0)}d. Nen giu nguyen hay can luu y gi? 1 cau ngan gon.`
            }]
          },
          {
            headers: {
              'x-api-key': claudeKey,
              'anthropic-version': '2023-06-01'
            }
          }
        );

        const aiMsg = response.data.content?.[0]?.text || '';
        if (aiMsg) {
          await addLog(account._id, account.name, 'ai', `Claude: ${aiMsg}`);
        }
      } catch {}
    }

    if (campaignsToPause.length > 0) {
      for (const item of campaignsToPause) {
        try {
          await fbPost(fbToken, item.campaign.id, { 
            status: 'PAUSED',
            budget_sharing_enabled: false,
            asset_based_budget_enabled: false
          });
        } catch (e) {
          // If budget fields fail, try simple status update
          if (e.message.includes('budget_sharing_enabled') || e.message.includes('asset_budget_sharing_enabled')) {
            await fbPost(fbToken, item.campaign.id, { status: 'PAUSED' });
          } else {
            throw e;
          }
        }
        await addLog(
          account._id,
          account.name,
          'warn',
          `Da tam dung: ${item.campaign.name} · ${item.pauseReason} · tieu ${item.spend.toLocaleString()}d · tin nhan ${item.messages}`
        );
      }

      await addLog(
        account._id,
        account.name,
        'warn',
        `Tam dung ${campaignsToPause.length} chien dich theo rule moi`
      );
    }
  } catch (error) {
    if (error.transient) {
      await addLog(account._id, account.name, 'warn', `Bo qua auto tam thoi: ${error.message}`);
      return;
    }

    await Account.findByIdAndUpdate(account._id, { status: 'error' });
    await addLog(account._id, account.name, 'error', `Loi: ${error.message}`);
  }
}

const accountTimers = {};
let facebookTokenCronTask = null;
let backgroundOrderSyncRunning = false;

async function startAccountScheduler(account) {
  if (accountTimers[account._id]) clearInterval(accountTimers[account._id]);
  const ms = (account.checkInterval || 60) * 1000;
  accountTimers[account._id] = setInterval(() => runAutoControl(account), ms);
  await runAutoControl(account);
}

function stopAccountScheduler(accountId) {
  if (accountTimers[accountId]) {
    clearInterval(accountTimers[accountId]);
    delete accountTimers[accountId];
  }
}

app.get('/api/clean-tokens', async (req, res) => {
  try {
    const result = await Account.updateMany({}, { $set: { fbToken: '' } });
    res.json({ success: true, message: 'Cleared old tokens', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/accounts', async (req, res) => {
  const accounts = await Account.find().select('-fbToken -claudeKey').sort('-createdAt').lean();
  res.json(accounts);
});

app.get('/api/stats', async (req, res) => {
  try {
    const today = todayStr();
    const totalAccounts = await Account.countDocuments();
    const connectedAccounts = await Account.countDocuments({ status: 'connected' });
    
    const todayCampaigns = await Campaign.find({ date: today }).lean();
    let activeCount = 0;
    let pausedCount = 0;
    let totalSpend = 0;
    let totalMessages = 0;

    for (const c of todayCampaigns) {
      const status = (c.status || '').toUpperCase();
      
      // Chỉ đếm những camp CÓ CHI TIÊU HÔM NAY (bất kể đang chạy hay đã dừng)
      if (c.spend > 0) {
        if (status === 'ACTIVE') activeCount++;
        if (status === 'PAUSED') pausedCount++;
      }
      
      totalSpend += (c.spend || 0);
      totalMessages += (c.messages || 0);
    }

    const avgCPM = totalMessages > 0 ? totalSpend / totalMessages : 0;

    const tStr = todayStr();
    const totalOrders = await Order.countDocuments(buildOrderQuery({
      fromDate: tStr,
      toDate: tStr
    }));

    res.json({
      totalAccounts,
      connectedAccounts,
      activeCount,
      pausedCount,
      totalSpend,
      totalMessages,
      avgCPM,
      totalOrders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/config', async (req, res) => {
  const config = await getAppConfig();
  res.json({
    hasFbToken: Boolean(config?.fbToken),
    fbTokenExpiresAt: config?.fbTokenExpiresAt || null,
    fbTokenLastRefreshTime: config?.fbTokenLastRefreshTime || null,
    fbTokenLastDebugTime: config?.fbTokenLastDebugTime || null,
    fbTokenLastRefreshError: config?.fbTokenLastRefreshError || '',
    hasClaudeKey: Boolean(config?.claudeKey),
    hasFbAppId: Boolean(config?.fbAppId),
    hasFbAppSecret: Boolean(config?.fbAppSecret),
    hasPancakeApiKey: Boolean(config?.pancakeApiKey),
    hasPancakeShopId: Boolean(config?.pancakeShopId),
    pancakeShopId: config?.pancakeShopId || '',
    autoRuleStartTime: config?.autoRuleStartTime || '00:00',
    autoRuleEndTime: config?.autoRuleEndTime || '08:30',
    
    dailyZeroMessageSpendLimit: config?.dailyZeroMessageSpendLimit || 25000,
    dailyHighCostPerMessageLimit: config?.dailyHighCostPerMessageLimit || 20000,
    dailyHighCostSpendLimit: config?.dailyHighCostSpendLimit || 50000,
    
    lifetimeZeroMessageSpendLimit: config?.lifetimeZeroMessageSpendLimit || 25000,
    lifetimeHighCostPerMessageLimit: config?.lifetimeHighCostPerMessageLimit || 20000,
    lifetimeHighCostSpendLimit: config?.lifetimeHighCostSpendLimit || 50000
  });
});

app.post(['/token', '/api/token'], async (req, res) => {
  try {
    const tokenState = await configureFacebookToken({
      app_id: req.body.app_id,
      app_secret: req.body.app_secret,
      long_lived_user_access_token: req.body.long_lived_user_access_token
    });

    res.status(201).json({
      ok: true,
      token: tokenState.token,
      expires_at: tokenState.expires_at,
      last_refresh_time: tokenState.last_refresh_time,
      last_debug_time: tokenState.last_debug_time
    });
  } catch (error) {
    await sendTokenAlert('Facebook token configure failed', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

app.get(['/token', '/api/token'], async (req, res) => {
  try {
    const [tokenState, config] = await Promise.all([
      FacebookToken.findOne({ key: FACEBOOK_TOKEN_KEY }),
      getAppConfig()
    ]);

    const token = tokenState?.token || config?.fbToken || '';
    if (!token) return res.status(404).json({ error: 'No Facebook token configured' });

    res.json({
      token,
      expires_at: tokenState?.expires_at || config?.fbTokenExpiresAt || null,
      last_refresh_time: tokenState?.last_refresh_time || config?.fbTokenLastRefreshTime || null,
      last_debug_time: tokenState?.last_debug_time || config?.fbTokenLastDebugTime || null,
      last_error: tokenState?.last_error || config?.fbTokenLastRefreshError || ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(['/token/refresh', '/api/token/refresh'], async (req, res) => {
  try {
    const result = await checkAndRefreshFacebookToken({ force: Boolean(req.body.force), source: 'api' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/auto-limits', async (req, res) => {
  try {
    const limits = {
      dailyZeroMessageSpendLimit: Number(req.body.dailyZeroMessageSpendLimit),
      dailyHighCostPerMessageLimit: Number(req.body.dailyHighCostPerMessageLimit),
      dailyHighCostSpendLimit: Number(req.body.dailyHighCostSpendLimit),
      lifetimeZeroMessageSpendLimit: Number(req.body.lifetimeZeroMessageSpendLimit),
      lifetimeHighCostPerMessageLimit: Number(req.body.lifetimeHighCostPerMessageLimit),
      lifetimeHighCostSpendLimit: Number(req.body.lifetimeHighCostSpendLimit),
      updatedAt: new Date()
    };
    
    const config = await Config.findOneAndUpdate(
      { key: 'app' },
      { $set: limits, $setOnInsert: { key: 'app' } },
      { upsert: true, new: true }
    );
    res.json({ ok: true, limits });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/auto-rules', async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Thieu startTime hoac endTime' });
    }
    // Validate HH:MM format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ error: 'Dinh dang thoi gian khong hop le (HH:MM)' });
    }
    const config = await Config.findOneAndUpdate(
      { key: 'app' },
      { $set: { autoRuleStartTime: startTime, autoRuleEndTime: endTime, updatedAt: new Date() }, $setOnInsert: { key: 'app' } },
      { upsert: true, new: true }
    );
    res.json({ ok: true, autoRuleStartTime: config.autoRuleStartTime, autoRuleEndTime: config.autoRuleEndTime });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/config', async (req, res) => {
  try {
    const updates = { updatedAt: new Date() };
    if (typeof req.body.fbToken === 'string' && req.body.fbToken.trim()) {
      updates.fbToken = req.body.fbToken.trim();
    }
    if (typeof req.body.claudeKey === 'string' && req.body.claudeKey.trim()) {
      updates.claudeKey = req.body.claudeKey.trim();
    }
    if (typeof req.body.fbAppId === 'string' && req.body.fbAppId.trim()) {
      updates.fbAppId = req.body.fbAppId.trim();
    }
    if (typeof req.body.fbAppSecret === 'string' && req.body.fbAppSecret.trim()) {
      updates.fbAppSecret = req.body.fbAppSecret.trim();
    }
    if (typeof req.body.pancakeApiKey === 'string' && req.body.pancakeApiKey.trim()) {
      updates.pancakeApiKey = req.body.pancakeApiKey.trim();
    }
    if (typeof req.body.pancakeShopId === 'string' && req.body.pancakeShopId.trim()) {
      updates.pancakeShopId = req.body.pancakeShopId.trim();
    }

    const config = await Config.findOneAndUpdate(
      { key: 'app' },
      { $set: updates, $setOnInsert: { key: 'app' } },
      { upsert: true, new: true }
    );

    res.json({
      ok: true,
      hasFbToken: Boolean(config.fbToken),
      hasClaudeKey: Boolean(config.claudeKey),
      hasFbAppId: Boolean(config.fbAppId),
      hasFbAppSecret: Boolean(config.fbAppSecret),
      hasPancakeApiKey: Boolean(config.pancakeApiKey),
      hasPancakeShopId: Boolean(config.pancakeShopId)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const payload = await buildAccountPayload(req.body);
    if (!payload.name || !payload.adAccountId) {
      return res.status(400).json({ error: 'Thieu ten tai khoan hoac Ad Account ID' });
    }
    if (!isValidAdAccountId(payload.adAccountId)) {
      return res.status(400).json({ error: 'Ad Account ID khong hop le. Dung dang act_123456789 hoac chi nhap so.' });
    }
    if (!payload.fbToken) {
      return res.status(400).json({ error: 'Thieu Facebook Access Token dung chung hoac rieng cho tai khoan' });
    }

    const account = await Account.create(payload);
    try {
      const { fbToken } = await getEffectiveSecrets(account);
      const me = await fbGet(fbToken, 'me', { fields: 'name,id' });
      await Account.findByIdAndUpdate(account._id, { status: 'connected' });
      await addLog(account._id, account.name, 'success', `Ket noi thanh cong: ${me.name} (${me.id})`);
    } catch (error) {
      await Account.findByIdAndUpdate(account._id, { status: 'error' });
      await addLog(account._id, account.name, 'error', `Loi ket noi: ${error.message}`);
    }

    res.json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/accounts/auto-discover', async (req, res) => {
  try {
    const config = await getAppConfig();
    const fbToken = req.body.fbToken || config?.fbToken || '';
    if (!fbToken) {
      return res.status(400).json({ error: 'Thieu Facebook Access Token. Hay luu token dung chung truoc.' });
    }

    // Fetch all ad accounts accessible by this token
    let allAdAccounts = [];
    let url = 'me/adaccounts';
    let params = { fields: 'name,account_id,account_status', limit: 200 };

    // Paginate through all results
    while (url) {
      const data = await fbGet(fbToken, url, params);
      if (data.data) allAdAccounts = allAdAccounts.concat(data.data);
      // Check for next page
      if (data.paging?.next) {
        // For subsequent pages, use full URL via axios directly
        try {
          const nextResp = await axios.get(data.paging.next);
          if (nextResp.data?.data) allAdAccounts = allAdAccounts.concat(nextResp.data.data);
          // Continue pagination
          if (nextResp.data?.paging?.next) {
            const nextResp2 = await axios.get(nextResp.data.paging.next);
            if (nextResp2.data?.data) allAdAccounts = allAdAccounts.concat(nextResp2.data.data);
          }
        } catch {}
        break;
      } else {
        break;
      }
    }

    if (!allAdAccounts.length) {
      return res.json({ ok: true, found: 0, created: [], skipped: [], message: 'Khong tim thay tai khoan quang cao nao.' });
    }

    // Check existing accounts in DB
    const existingAccounts = await Account.find({}, 'adAccountId');
    const existingIds = new Set(existingAccounts.map(a => {
      const id = a.adAccountId;
      return id.startsWith('act_') ? id : `act_${id}`;
    }));

    const created = [];
    const skipped = [];

    for (const adAccount of allAdAccounts) {
      const actId = `act_${adAccount.account_id}`;
      if (existingIds.has(actId)) {
        skipped.push({ name: adAccount.name, adAccountId: actId });
        continue;
      }

      try {
        const payload = await buildAccountPayload({
          name: adAccount.name || `Account ${adAccount.account_id}`,
          adAccountId: actId,
          fbToken: fbToken,
          spendThreshold: 20000,
          checkInterval: 60
        });
        const account = await Account.create(payload);
        created.push({ id: account._id, name: account.name, adAccountId: actId });
        existingIds.add(actId); // Prevent duplicates within same batch
      } catch (error) {
        skipped.push({ name: adAccount.name, adAccountId: actId, error: error.message });
      }
    }

    res.json({
      ok: true,
      found: allAdAccounts.length,
      created,
      skipped,
      message: `Tim thay ${allAdAccounts.length} tai khoan. Da them ${created.length}, bo qua ${skipped.length} (da ton tai).`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/accounts/bulk', async (req, res) => {
  try {
    const items = Array.isArray(req.body.accounts)
      ? req.body.accounts
      : Array.isArray(req.body.items)
        ? req.body.items
        : [];
    if (!items.length) {
      return res.status(400).json({ error: 'Chua co tai khoan nao de them' });
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < items.length; i += 1) {
      try {
        const payload = await buildAccountPayload(items[i]);
        if (!payload.name || !payload.adAccountId) {
          throw new Error('Thieu ten tai khoan hoac Ad Account ID');
        }
        if (!isValidAdAccountId(payload.adAccountId)) {
          throw new Error('Ad Account ID khong hop le. Dung dang act_123456789 hoac chi nhap so.');
        }
        if (!payload.fbToken) {
          throw new Error('Thieu Facebook Access Token dung chung');
        }

        const account = await Account.create(payload);
        created.push({ id: account._id, name: account.name });
      } catch (error) {
        errors.push({ index: i, name: items[i]?.name || '', error: error.message });
      }
    }

    res.json({ ok: true, created, errors });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    if (!updates.fbToken) delete updates.fbToken;
    if (!updates.claudeKey) delete updates.claudeKey;
    if (Object.prototype.hasOwnProperty.call(updates, 'adAccountId')) {
      updates.adAccountId = normalizeAdAccountId(updates.adAccountId);
      if (!isValidAdAccountId(updates.adAccountId)) {
        return res.status(400).json({ error: 'Ad Account ID khong hop le. Dung dang act_123456789 hoac chi nhap so.' });
      }
    }

    const account = await Account.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!account) return res.status(404).json({ error: 'Not found' });

    if (account.autoEnabled) {
      await startAccountScheduler(account);
      await addLog(account._id, account.name, 'info', 'Da cap nhat cau hinh tu dong');
    }

    res.json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  await Account.findByIdAndDelete(req.params.id);
  await Campaign.deleteMany({ accountId: req.params.id });
  await Log.deleteMany({ accountId: req.params.id });
  stopAccountScheduler(req.params.id);
  res.json({ ok: true });
});

app.post('/api/accounts/:id/auto', async (req, res) => {
  try {
    console.log('TOGGLE AUTO BODY:', req.body);

    const { enabled } = req.body;
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Not found' });

    account.autoEnabled = Boolean(enabled);
    await account.save();

    if (account.autoEnabled) {
      await startAccountScheduler(account);
      await addLog(account._id, account.name, 'info', 'AUTO: ON');
    } else {
      stopAccountScheduler(account._id.toString());
      await addLog(account._id, account.name, 'warn', 'AUTO: OFF');
    }

    res.json({ ok: true, autoEnabled: account.autoEnabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts/toggle-auto-bulk', async (req, res) => {
  try {
    const { ids, enabled } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'Ids must be an array' });
    
    await Account.updateMany({ _id: { $in: ids } }, { autoEnabled: Boolean(enabled) });
    
    const accounts = await Account.find({ _id: { $in: ids } });
    for (const account of accounts) {
      if (account.autoEnabled) {
        await startAccountScheduler(account);
        await addLog(account._id, account.name, 'info', 'AUTO: ON (Bulk)');
      } else {
        stopAccountScheduler(account._id.toString());
        await addLog(account._id, account.name, 'warn', 'AUTO: OFF (Bulk)');
      }
    }
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts/delete-bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    console.log(`Bulk deleting ${ids?.length} accounts...`);
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'Ids must be an array' });
    
    for (const id of ids) {
      stopAccountScheduler(id);
    }
    
    const accResult = await Account.deleteMany({ _id: { $in: ids } });
    const campResult = await Campaign.deleteMany({ accountId: { $in: ids } });
    const logResult = await Log.deleteMany({ accountId: { $in: ids } });
    
    console.log(`Deleted: ${accResult.deletedCount} accounts, ${campResult.deletedCount} campaigns, ${logResult.deletedCount} logs`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts/:id/refresh', async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.status(404).json({ error: 'Not found' });

  try {
    const result = await fetchAccountData(account);
    await Account.findByIdAndUpdate(account._id, {
      lastChecked: new Date(),
      status: 'connected'
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    if (error.transient) {
      await addLog(account._id, account.name, 'warn', `Bo qua refresh tam thoi: ${error.message}`);
      return res.json({ ok: false, skipped: true, transient: true, accountId: account._id, error: error.message });
    }

    await Account.findByIdAndUpdate(account._id, { status: 'error' });
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/campaigns/:campaignId/toggle', async (req, res) => {
  const { accountId, currentStatus } = req.body;
  const date = normalizeCampaignDate(req.body.date);
  const account = await Account.findById(accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

  try {
    const { fbToken } = await getEffectiveSecrets(account);
    if (!fbToken) return res.status(400).json({ error: 'Thieu Facebook Access Token' });

    await fbPost(fbToken, req.params.campaignId, { status: newStatus });
    await Campaign.findOneAndUpdate(
      { accountId, campaignId: req.params.campaignId, date },
      { $set: { status: newStatus, updatedAt: new Date() } },
      { new: true }
    );

    await addLog(
      account._id,
      account.name,
      newStatus === 'ACTIVE' ? 'success' : 'warn',
      `Thu cong: ${currentStatus} -> ${newStatus} (${req.params.campaignId})`
    );

    res.json({ ok: true, newStatus });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/campaigns/create-from-posts', async (req, res) => {
  try {
    const { accountId } = req.body;
    const codes = parseCodeList(req.body.codes);
    const selectedPageId = String(req.body.pageId || '').trim();
    const dailyBudget = Math.max(1000, Number(req.body.dailyBudget || DEFAULT_CAMPAIGN_DAILY_BUDGET));
    const campaignPrefix = String(req.body.campaignPrefix || '').trim();
    const adNamePrefix = String(req.body.adNamePrefix || DEFAULT_AD_NAME_PREFIX).trim() || DEFAULT_AD_NAME_PREFIX;
    const { ageMin, ageMax } = parseCampaignAgeRange(req.body.ageMin, req.body.ageMax);

    if (!accountId) return res.status(400).json({ error: 'Thieu tai khoan quang cao' });
    if (!codes.length) return res.status(400).json({ error: 'Chua co ma san pham nao' });

    const account = await Account.findById(accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const { fbToken } = await getEffectiveSecrets(account);
    if (!fbToken) return res.status(400).json({ error: 'Thieu Facebook Access Token' });

    const acctId = account.adAccountId.startsWith('act_')
      ? account.adAccountId
      : `act_${account.adAccountId}`;
    const scheduledStart = parseVietnamCampaignStart(req.body.startTime);
    const campaignDate = todayStr();

    const created = [];
    const errors = [];

    for (const code of codes) {
      try {
        const postQuery = {
          message: { $regex: escapeRegExp(code), $options: 'i' }
        };
        if (selectedPageId) {
          postQuery.pageId = selectedPageId;
        }

        const post = await FacebookPost.findOne(postQuery).sort({ createdTime: -1, fetchedAt: -1 }).lean();

        if (!post) {
          const pageScope = selectedPageId ? ` tren Page ${selectedPageId}` : '';
          errors.push({ code, error: `Khong tim thay bai viet da luu co ma nay${pageScope}` });
          continue;
        }

        const cleanCode = code.replace(/\s+/g, ' ');
        const baseName = buildCampaignName(cleanCode, campaignPrefix);
        const pageId = getPostPageId(post);
        if (!pageId) {
          errors.push({ code, error: 'Khong xac dinh duoc Page ID cua bai viet de tao camp luot mua qua tin nhan' });
          continue;
        }

        const adName = buildAdName(cleanCode, adNamePrefix);
        const campaign = await fbPost(fbToken, `${acctId}/campaigns`, {
          name: baseName,
          objective: DEFAULT_CAMPAIGN_OBJECTIVE,
          status: 'ACTIVE',
          special_ad_categories: [],
          buying_type: 'AUCTION',
          daily_budget: Math.round(dailyBudget),
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
        });

        const adSetPayload = {
          name: DEFAULT_AD_SET_NAME,
          campaign_id: campaign.id,
          destination_type: DEFAULT_AD_SET_DESTINATION_TYPE,
          billing_event: 'IMPRESSIONS',
          optimization_goal: DEFAULT_AD_SET_OPTIMIZATION_GOAL,
          promoted_object: { page_id: pageId },
          attribution_spec: [{ event_type: 'CLICK_THROUGH', window_days: 1 }],
          targeting: {
            geo_locations: {
              countries: ['VN'],
              location_types: ['home', 'recent']
            },
            targeting_automation: {
              advantage_audience: 0
            },
            genders: [2],
            age_min: ageMin,
            age_max: ageMax
          },
          start_time: scheduledStart.fbStartTime,
          status: 'ACTIVE'
        };

        const adSet = await fbPost(fbToken, `${acctId}/adsets`, adSetPayload);

        const creativePayload = {
          name: `${baseName} - Creative`,
          object_story_id: post.postId,
          contextual_multi_ads: {
            enroll_status: 'OPT_OUT'
          }
        };

        const creative = await fbPost(fbToken, `${acctId}/adcreatives`, creativePayload);

        const ad = await fbPost(fbToken, `${acctId}/ads`, {
          name: adName,
          adset_id: adSet.id,
          creative: { creative_id: creative.id },
          status: 'ACTIVE'
        });

        await upsertDailyCampaign(account._id, campaign.id, campaignDate, {
          name: baseName,
          status: 'ACTIVE',
          dailyBudget,
          budgetType: 'DAILY'
        });

        await addLog(
          account._id,
          account.name,
          'success',
          `Tao camp luot mua qua tin nhan tu bai viet: ${cleanCode} -> ${campaign.id}, bat dau ${scheduledStart.display}`
        );

        created.push({
          code,
          postId: post.postId,
          pageName: post.pageName,
          objective: DEFAULT_CAMPAIGN_OBJECTIVE,
          destinationType: DEFAULT_AD_SET_DESTINATION_TYPE,
          optimizationGoal: DEFAULT_AD_SET_OPTIMIZATION_GOAL,
          adName,
          campaignId: campaign.id,
          adSetId: adSet.id,
          creativeId: creative.id,
          adId: ad.id,
          status: 'ACTIVE',
          startTime: scheduledStart.fbStartTime,
          startTimeUtc: scheduledStart.utc,
          startTimeDisplay: scheduledStart.display
        });
      } catch (error) {
        errors.push({ code, error: error.message });
      }
    }

    res.json({ ok: true, created, errors, startTime: scheduledStart.fbStartTime, startTimeDisplay: scheduledStart.display });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/accounts/:id/campaigns', async (req, res) => {
  const date = req.query.date || todayStr();
  const campaigns = await Campaign.find({ accountId: req.params.id, date }).sort('-spend').lean();
  res.json(campaigns);
});

app.get('/api/campaigns/today', async (req, res) => {
  const date = req.query.date || todayStr();
  const campaigns = await Campaign.find({ date })
    .populate('accountId', 'name adAccountId')
    .sort('-spend')
    .lean();
  res.json(campaigns);
});

app.get('/api/logs', async (req, res) => {
  const { accountId, limit = 100 } = req.query;
  const query = accountId ? { accountId } : {};
  const safeLimit = parseBoundedInt(limit, 100, 1, 500);
  const logs = await Log.find(query).sort('-createdAt').limit(safeLimit).lean();
  res.json(logs);
});

app.delete('/api/logs', async (req, res) => {
  const { accountId } = req.query;
  const query = accountId ? { accountId } : {};
  await Log.deleteMany(query);
  res.json({ ok: true });
});

app.post('/api/test-token', async (req, res) => {
  try {
    const { fbToken } = req.body;
    if (!fbToken) return res.status(400).json({ error: 'Thieu token' });

    const me = await fbGet(fbToken, 'me', { fields: 'name,id' });
    res.json({ ok: true, name: me.name, id: me.id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/webhooks/pancake', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Received Pancake Webhook payload:', JSON.stringify(payload, null, 2));
    
    // Pancake webhook structure usually has event type and data
    // Fallback to simple extraction if exact structure is unknown
    const orderData = payload.data || payload || {};
    const orderId = orderData.id || orderData.order_id || `temp_${Date.now()}`;
    const status = orderData.status || payload.event || 'unknown';
    
    const newOrder = await Order.findOneAndUpdate(
      { orderId: String(orderId) },
      {
        status: String(status),
        customerName: orderData.customer_name || orderData.customer?.name || '',
        totalPrice: Number(orderData.total_price || orderData.total || 0),
        rawData: payload,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: 'Webhook processed successfully', orderId: newOrder.orderId });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const { limit = 100, fromDate, toDate } = req.query;
    const safeLimit = parseBoundedInt(limit, 100, 1, 5000);
    const orders = await Order.find(buildOrderQuery({ fromDate, toDate }))
      .select('orderId status rawData createdAt')
      .sort('-createdAt')
      .limit(safeLimit)
      .lean();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/sku-counts', async (req, res) => {
  try {
    const fromDate = req.query.fromDate || todayStr();
    const { toDate } = req.query;
    const orders = await Order.find(buildOrderQuery({ fromDate, toDate }))
      .select('rawData')
      .lean();
    const counts = {};

    for (const order of orders) {
      const orderSkus = new Set();
      for (const item of getOrderItemsFromRaw(order.rawData || {})) {
        const sku = normalizeSkuKey(getOrderItemSku(item));
        if (!sku) continue;
        orderSkus.add(sku);
      }
      for (const sku of orderSkus) {
        counts[sku] = (counts[sku] || 0) + 1;
      }
    }

    res.json({ ok: true, counts, totalOrders: orders.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function syncOrdersFromPancake(fromDate, toDate = null) {
  const config = await getAppConfig();
  if (!config || !config.pancakeApiKey || !config.pancakeShopId) {
    throw new Error('Chưa cấu hình API Key hoặc Shop ID của Pancake POS');
  }

  let synced = 0;
  const targetDateStr = fromDate ? `${fromDate}T00:00:00Z` : '2026-02-22T00:00:00Z';
  const targetFromDateRaw = new Date(targetDateStr);
  const targetFromDate = new Date(targetFromDateRaw.getTime() - 7 * 60 * 60 * 1000);
  
  let targetToDate = null;
  if (toDate) {
    const d = new Date(`${toDate}T23:59:59Z`);
    targetToDate = new Date(d.getTime() - 7 * 60 * 60 * 1000);
  }

  let page = 1;
  let keepFetching = true;

  while (keepFetching) {
    const response = await axios.get(`https://pos.pages.fm/api/v1/shops/${config.pancakeShopId}/orders`, {
      params: { api_key: config.pancakeApiKey, page_number: page, page: page }
    });

    const ordersData = response.data.data || [];
    if (ordersData.length === 0) break;

    const operations = [];
    for (const order of ordersData) {
      const orderDate = new Date(order.inserted_at || order.created_at || Date.now());
      
      if (orderDate < targetFromDate) {
        keepFetching = false;
      }

      if (targetToDate && orderDate > targetToDate) {
        continue;
      }

      if (orderDate >= targetFromDate && (!targetToDate || orderDate <= targetToDate)) {
        operations.push({
          updateOne: {
            filter: { orderId: String(order.id) },
            update: {
              $set: {
                status: String(order.status || 'unknown'),
                customerName: order.customer_name || order.bill_full_name || '',
                totalPrice: Number(order.total_price || 0),
                rawData: order,
                createdAt: orderDate
              }
            },
            upsert: true
          }
        });
        synced++;
      }
    }

    if (operations.length) {
      await Order.bulkWrite(operations, { ordered: false });
    }

    page++;
    if (page > 200) keepFetching = false;
  }
  return synced;
}

app.post('/api/orders/sync', async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const synced = await syncOrdersFromPancake(fromDate, toDate);
    res.json({ success: true, synced });
  } catch (error) {
    console.error('Lỗi đồng bộ Pancake API:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

// ── Pages & Posts (for campaign creation) ──

const POST_CACHE_TTL_MS = 5 * 60 * 1000;
const postCache = new Map();

function parseBoundedInt(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getPostCache(key, refresh = false) {
  if (refresh) return null;
  const cached = postCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > POST_CACHE_TTL_MS) {
    postCache.delete(key);
    return null;
  }
  return cached.value;
}

function setPostCache(key, value) {
  postCache.set(key, { value, createdAt: Date.now() });
  return value;
}

function mapFacebookPost(post, page = {}) {
  return {
    id: post.id,
    message: post.message || '',
    createdTime: post.created_time,
    permalink: post.permalink_url,
    picture: post.full_picture || '',
    shares: post.shares?.count || 0,
    likes: post.likes?.summary?.total_count || 0,
    comments: post.comments?.summary?.total_count || 0,
    pageName: page.name || '',
    pageId: page.id || '',
    pageAvatar: page.picture?.data?.url || ''
  };
}

function mapSavedFacebookPost(post = {}) {
  return {
    id: post.postId,
    message: post.message || '',
    createdTime: post.createdTime,
    permalink: post.permalink || '',
    picture: post.picture || '',
    shares: post.shares || 0,
    likes: post.likes || 0,
    comments: post.comments || 0,
    pageName: post.pageName || '',
    pageId: post.pageId || '',
    pageAvatar: post.pageAvatar || ''
  };
}

async function saveFacebookPosts(mappedPosts, rawPosts = []) {
  const posts = (mappedPosts || []).filter(post => post.id);
  if (!posts.length) return;

  const now = new Date();
  const operations = posts.map((post, index) => ({
    updateOne: {
      filter: { postId: post.id },
      update: {
        $set: {
          pageId: post.pageId || '',
          pageName: post.pageName || '',
          pageAvatar: post.pageAvatar || '',
          message: post.message || '',
          createdTime: post.createdTime ? new Date(post.createdTime) : null,
          permalink: post.permalink || '',
          picture: post.picture || '',
          shares: Number(post.shares || 0),
          likes: Number(post.likes || 0),
          comments: Number(post.comments || 0),
          rawData: rawPosts[index] || {},
          fetchedAt: now,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      upsert: true
    }
  }));

  try {
    await FacebookPost.bulkWrite(operations, { ordered: false });
  } catch (error) {
    console.error('Save Facebook posts failed:', error.message);
  }
}

async function fetchRecentPostsForPage(page, fallbackToken, options = {}) {
  const token = page.access_token || fallbackToken;
  const limit = parseBoundedInt(options.limit, POSTS_PER_PAGE_LIMIT, 1, POSTS_PER_PAGE_LIMIT);
  const maxPages = parseBoundedInt(options.maxPages, 4, 1, 5);
  const requestLimit = Math.min(limit, META_POST_REQUEST_LIMIT);
  const fields = 'id,message,created_time,permalink_url,full_picture,shares,likes.summary(true),comments.summary(true)';
  let posts = [];

  const first = await fbGet(token, `${page.id}/posts`, { fields, limit: requestLimit });
  if (first.data) posts = posts.concat(first.data);

  let fetchedPages = 1;
  let nextUrl = first.paging?.next;
  while (nextUrl && fetchedPages < maxPages && posts.length < limit) {
    const resp = await axios.get(nextUrl);
    if (resp.data?.data) posts = posts.concat(resp.data.data);
    nextUrl = resp.data?.paging?.next || null;
    fetchedPages += 1;
  }

  const limitedPosts = posts.slice(0, limit);
  const mappedPosts = limitedPosts.map(post => mapFacebookPost(post, page));
  await saveFacebookPosts(mappedPosts, limitedPosts);
  return mappedPosts;
}

async function mapInBatches(items, batchSize, iteratee) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(chunk.map(iteratee));
    results.push(...settled);
  }
  return results;
}

app.get('/api/pages', async (req, res) => {
  try {
    const config = await getAppConfig();
    const fbToken = config?.fbToken;
    if (!fbToken) return res.status(400).json({ error: 'Chưa cấu hình Facebook Token dùng chung' });

    let allPages = [];
    let url = 'me/accounts';
    let params = { fields: 'name,id,access_token,category,picture{url},fan_count', limit: 100 };

    // First page
    const first = await fbGet(fbToken, url, params);
    if (first.data) allPages = allPages.concat(first.data);

    // Paginate
    let nextUrl = first.paging?.next;
    while (nextUrl) {
      try {
        const resp = await axios.get(nextUrl);
        if (resp.data?.data) allPages = allPages.concat(resp.data.data);
        nextUrl = resp.data?.paging?.next || null;
      } catch {
        break;
      }
    }

    res.json({ ok: true, pages: allPages, total: allPages.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/posts/saved', async (req, res) => {
  try {
    const limit = parseBoundedInt(req.query.limit, 1000, 1, 5000);
    const q = String(req.query.q || '').trim();
    const pageId = String(req.query.pageId || '').trim();
    const query = {};

    if (pageId) query.pageId = pageId;
    if (q) {
      const pattern = new RegExp(escapeRegExp(q), 'i');
      query.$or = [
        { message: pattern },
        { pageName: pattern },
        { postId: pattern }
      ];
    }

    const posts = await FacebookPost.find(query)
      .sort({ createdTime: -1, fetchedAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      ok: true,
      posts: posts.map(mapSavedFacebookPost),
      total: posts.length,
      source: 'saved'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/pages/all-posts', async (req, res) => {
  try {
    const config = await getAppConfig();
    const fbToken = config?.fbToken;
    if (!fbToken) return res.status(400).json({ error: 'Missing shared Facebook Token' });
    const perPage = parseBoundedInt(req.query.perPage, POSTS_PER_PAGE_LIMIT, 1, POSTS_PER_PAGE_LIMIT);
    const totalLimit = parseBoundedInt(req.query.limit, 5000, 10, 5000);
    const maxPages = parseBoundedInt(req.query.maxPages, 4, 1, 5);
    const refresh = req.query.refresh === '1';
    const cacheKey = `all-posts:${perPage}:${totalLimit}:${maxPages}`;
    const cached = getPostCache(cacheKey, refresh);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
    if (!fbToken) return res.status(400).json({ error: 'Chưa cấu hình Facebook Token dùng chung' });

    // 1. Get all pages
    let allPages = [];
    const first = await fbGet(fbToken, 'me/accounts', {
      fields: 'name,id,access_token,picture{url}',
      limit: 100
    });
    if (first.data) allPages = allPages.concat(first.data);
    let nextPageUrl = first.paging?.next;
    while (nextPageUrl) {
      try {
        const resp = await axios.get(nextPageUrl);
        if (resp.data?.data) allPages = allPages.concat(resp.data.data);
        nextPageUrl = resp.data?.paging?.next || null;
      } catch { break; }
    }

    const results = await mapInBatches(
      allPages,
      6,
      page => fetchRecentPostsForPage(page, fbToken, { limit: perPage, maxPages })
    );

    let allPosts = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allPosts = allPosts.concat(r.value);
    }
    // Sort by date descending
    allPosts.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
    allPosts = allPosts.slice(0, totalLimit);

    const payload = {
      ok: true,
      posts: allPosts,
      total: allPosts.length,
      pageCount: allPages.length,
      perPage,
      maxPages
    };

    res.json(setPostCache(cacheKey, payload));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/pages/:pageId/posts', async (req, res) => {
  try {
    const config = await getAppConfig();
    const fbToken = config?.fbToken;
    if (!fbToken) return res.status(400).json({ error: 'Chưa cấu hình Facebook Token dùng chung' });

    const { pageId } = req.params;
    const limit = parseBoundedInt(req.query.limit, POSTS_PER_PAGE_LIMIT, 1, POSTS_PER_PAGE_LIMIT);
    const maxPages = parseBoundedInt(req.query.maxPages, 4, 1, 5);
    const refresh = req.query.refresh === '1';
    const cacheKey = `page-posts:${pageId}:${limit}:${maxPages}`;
    const cached = getPostCache(cacheKey, refresh);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // First get the page access token
    let pageToken = fbToken;
    let pageInfo = { id: pageId };
    try {
      pageInfo = await fbGet(fbToken, pageId, { fields: 'name,id,access_token,picture{url}' });
      if (pageInfo.access_token) pageToken = pageInfo.access_token;
    } catch {}

    const posts = await fetchRecentPostsForPage(
      { ...pageInfo, id: pageId, access_token: pageToken },
      fbToken,
      { limit, maxPages }
    );
    const payload = { ok: true, posts, total: posts.length, limit, maxPages };

    res.json(setPostCache(cacheKey, payload));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

async function cleanupCampaignDailyDuplicates() {
  const duplicateGroups = await Campaign.aggregate([
    { $match: { date: { $type: 'string' } } },
    { $sort: { updatedAt: -1, _id: -1 } },
    {
      $group: {
        _id: { accountId: '$accountId', campaignId: '$campaignId', date: '$date' },
        ids: { $push: '$_id' },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);

  const duplicateIds = duplicateGroups.flatMap(group => group.ids.slice(1));
  if (!duplicateIds.length) return;

  const result = await Campaign.deleteMany({ _id: { $in: duplicateIds } });
  console.log(`Removed ${result.deletedCount} duplicate campaign daily records`);
}

async function ensureCampaignDailyStorage() {
  const campaignsCollection = mongoose.connection.collection('campaigns');

  try {
    await campaignsCollection.dropIndex('campaign_id_1');
    console.log('Dropped legacy index: campaign_id_1');
  } catch (e) {
    // Index might not exist, that's fine.
  }

  await cleanupCampaignDailyDuplicates();
  await Campaign.createIndexes();
  console.log('Campaign daily indexes ready');
}

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fb_ads_manager';
const PORT = process.env.PORT || 3000;

mongoose.connect(MONGO_URI).then(async () => {
  console.log('MongoDB connected');
  await ensureCampaignDailyStorage();
  try {
    await bootstrapFacebookTokenFromEnv();
  } catch (error) {
    await sendTokenAlert('Facebook token environment bootstrap failed', { error: error.message });
  }
  checkAndRefreshFacebookToken({ source: 'startup' }).catch(error => {
    console.error(`Facebook token startup check failed: ${error.message}`);
  });
  facebookTokenCronTask = startFacebookTokenCron();

  const autoAccounts = await Account.find({ autoEnabled: true });
  for (const account of autoAccounts) {
    console.log(`Resuming auto for: ${account.name}`);
    startAccountScheduler(account);
  }

  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

  // Background Order Sync from Pancake (every 10 minutes)
  setInterval(async () => {
    if (backgroundOrderSyncRunning) return;
    backgroundOrderSyncRunning = true;
    try {
      console.log('Background Sync: Fetching orders from Pancake...');
      // Sync last 3 days to be safe
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 3);
      const fromDateStr = fromDate.toISOString().split('T')[0];
      
      await syncOrdersFromPancake(fromDateStr);
      console.log('Background Sync: Orders updated successfully.');
    } catch (err) {
      console.error('Background Order Sync failed:', err.message);
    } finally {
      backgroundOrderSyncRunning = false;
    }
  }, 10 * 60 * 1000);

}).catch(error => {
  console.error('MongoDB error:', error.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (facebookTokenCronTask) {
    facebookTokenCronTask.stop();
  }
  for (const accountId in accountTimers) {
    stopAccountScheduler(accountId);
  }
  await mongoose.connection.close();
  process.exit(0);
});
