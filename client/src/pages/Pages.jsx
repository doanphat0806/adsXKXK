import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../lib/api';
import { useAppContext } from '../contexts/AppContext';
import { toast } from 'react-toastify';

const ALL_POSTS_LIMIT = 3000;
const POSTS_PER_PAGE_PREVIEW = 40;
const SELECTED_PAGE_POST_LIMIT = 120;
const POST_RENDER_BATCH = 120;
const POSTS_AUTO_REFRESH_MS = 5 * 60 * 1000;
const AD_NAME_PREFIX_OPTIONS = ['PHAT', 'BINH', 'HIEU'];

function getDefaultCampaignStartTime() {
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(
    vnNow.getUTCFullYear(),
    vnNow.getUTCMonth(),
    vnNow.getUTCDate() + 1,
    6,
    1,
    0
  ));
  const yyyy = start.getUTCFullYear();
  const mm = String(start.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(start.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T06:01`;
}

function normalizeAccountQuery(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getAccountLabel(account) {
  if (!account) return '';
  return `${account.name} - ${account.adAccountId}`;
}

function accountMatchesQuery(account, query) {
  const normalizedQuery = normalizeAccountQuery(query);
  if (!normalizedQuery) return true;

  const compactQuery = normalizedQuery.replace(/\s+/g, '');
  const haystack = normalizeAccountQuery(`${account.name} ${account.adAccountId}`);
  return haystack.includes(normalizedQuery) || haystack.replace(/\s+/g, '').includes(compactQuery);
}

export default function CreateCampaign() {
  const { allAccounts, loadTodayCampaigns } = useAppContext();
  const [pages, setPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);

  const [selectedPage, setSelectedPage] = useState(null); // null = show all
  const [allPosts, setAllPosts] = useState([]); // all posts from all pages
  const [pagePosts, setPagePosts] = useState([]); // posts of selected page
  const [pagePostCache, setPagePostCache] = useState({});
  const [loadingAllPosts, setLoadingAllPosts] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [visiblePostCount, setVisiblePostCount] = useState(POST_RENDER_BATCH);

  const [searchPage, setSearchPage] = useState('');
  const [searchPost, setSearchPost] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountQuery, setAccountQuery] = useState('');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [adNamePrefix, setAdNamePrefix] = useState(AD_NAME_PREFIX_OPTIONS[0]);
  const [campaignCodes, setCampaignCodes] = useState('');
  const [dailyBudget, setDailyBudget] = useState(300000);
  const [campaignStartTime, setCampaignStartTime] = useState(getDefaultCampaignStartTime);
  const [ageMin, setAgeMin] = useState(22);
  const [ageMax, setAgeMax] = useState(47);
  const [creatingCampaigns, setCreatingCampaigns] = useState(false);
  const [campaignCreateResult, setCampaignCreateResult] = useState(null);
  const allPostsLoadingRef = useRef(false);

  const quickAccountOptions = useMemo(() => {
    return [...allAccounts].sort((a, b) => {
      const statusA = a.status === 'connected' ? 0 : 1;
      const statusB = b.status === 'connected' ? 0 : 1;
      return statusA - statusB || a.name.localeCompare(b.name);
    });
  }, [allAccounts]);

  const selectedAccount = useMemo(() => {
    return allAccounts.find(account => account._id === selectedAccountId) || null;
  }, [allAccounts, selectedAccountId]);

  const filteredAccountOptions = useMemo(() => {
    const query = normalizeAccountQuery(accountQuery);
    if (!query) return quickAccountOptions.slice(0, 50);

    return quickAccountOptions
      .filter(account => accountMatchesQuery(account, query))
      .slice(0, 50);
  }, [accountQuery, quickAccountOptions]);

  const selectAccount = useCallback((account) => {
    setSelectedAccountId(account._id);
    setAccountQuery(getAccountLabel(account));
    setIsAccountMenuOpen(false);
  }, []);

  const handleAccountInputChange = (event) => {
    const nextQuery = event.target.value;
    setAccountQuery(nextQuery);
    setIsAccountMenuOpen(true);

    const query = normalizeAccountQuery(nextQuery);
    if (!query) {
      setSelectedAccountId('');
      return;
    }

    const firstMatch = quickAccountOptions.find(account => accountMatchesQuery(account, query));
    setSelectedAccountId(firstMatch?._id || '');
  };

  const handleAccountInputKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsAccountMenuOpen(false);
      setAccountQuery(selectedAccount ? getAccountLabel(selectedAccount) : '');
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredAccountOptions[0]) {
        selectAccount(filteredAccountOptions[0]);
      }
    }
  };

  // ── Load Pages ──
  const loadPages = useCallback(async () => {
    setLoadingPages(true);
    try {
      const data = await api('GET', '/pages');
      setPages(data.pages || []);
    } catch (e) {
      toast.error('Lỗi tải Pages: ' + e.message);
    } finally {
      setLoadingPages(false);
    }
  }, []);

  // ── Load ALL posts from ALL pages ──
  const loadAllPosts = useCallback(async (refresh = false, options = {}) => {
    const { silent = false } = options;
    if (allPostsLoadingRef.current) return;
    allPostsLoadingRef.current = true;
    if (!silent) setLoadingAllPosts(true);
    try {
      const refreshParam = refresh ? '&refresh=1' : '';
      const path = `/pages/all-posts?limit=${ALL_POSTS_LIMIT}&perPage=${POSTS_PER_PAGE_PREVIEW}${refreshParam}`;
      const data = await api('GET', path);
      setAllPosts(data.posts || []);
      setVisiblePostCount(POST_RENDER_BATCH);
      if (!silent) toast.success(`Đã tải ${data.total} bài viết từ ${data.pageCount} Pages`);
    } catch (e) {
      if (!silent) toast.error('Lỗi tải bài viết: ' + e.message);
    } finally {
      allPostsLoadingRef.current = false;
      if (!silent) setLoadingAllPosts(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
    loadAllPosts(false);
    const interval = setInterval(() => {
      loadAllPosts(true, { silent: true });
    }, POSTS_AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadPages, loadAllPosts]);

  // ── Load Posts for a specific Page ──
  const selectPage = async (page) => {
    if (selectedPage?.id === page.id) {
      // Deselect → show all
      setSelectedPage(null);
      setPagePosts([]);
      setVisiblePostCount(POST_RENDER_BATCH);
      return;
    }
    setSelectedPage(page);
    if (pagePostCache[page.id]) {
      setPagePosts(pagePostCache[page.id]);
      setVisiblePostCount(POST_RENDER_BATCH);
      return;
    }

    setPagePosts([]);
    setLoadingPosts(true);
    try {
      const data = await api('GET', `/pages/${page.id}/posts?limit=${SELECTED_PAGE_POST_LIMIT}`);
      const posts = data.posts || [];
      setPagePosts(posts);
      setVisiblePostCount(POST_RENDER_BATCH);
      setPagePostCache(prev => ({ ...prev, [page.id]: posts }));
    } catch (e) {
      toast.error('Lỗi tải bài viết: ' + e.message);
    } finally {
      setLoadingPosts(false);
    }
  };

  const showAllPages = () => {
    setSelectedPage(null);
    setPagePosts([]);
    setVisiblePostCount(POST_RENDER_BATCH);
  };

  const createCampaignsFromCodes = async () => {
    const codes = campaignCodes
      .split(/[\n,;|]+/)
      .map(code => code.trim())
      .filter(Boolean);

    if (!selectedAccountId) {
      toast.error('Chọn tài khoản quảng cáo trước');
      return;
    }
    if (!codes.length) {
      toast.error('Nhập ít nhất một mã sản phẩm');
      return;
    }

    setCreatingCampaigns(true);
    setCampaignCreateResult(null);
    try {
      const result = await api('POST', '/campaigns/create-from-posts', {
        accountId: selectedAccountId,
        codes,
        dailyBudget,
        startTime: campaignStartTime,
        ageMin,
        ageMax,
        adNamePrefix,
        pageId: selectedPage?.id || ''
      });
      setCampaignCreateResult(result);
      if (result.created?.length) {
        toast.success(`Đã tạo ${result.created.length} camp active, bắt đầu ${result.startTimeDisplay || '06:01 ngày mai'}`);
        loadTodayCampaigns();
      }
      if (result.errors?.length) {
        toast.warn(`${result.errors.length} mã chưa tạo được`);
      }
    } catch (e) {
      toast.error('Lỗi tạo camp: ' + e.message);
    } finally {
      setCreatingCampaigns(false);
    }
  };

  // Determine which posts to display
  const rawPosts = selectedPage ? pagePosts : allPosts;
  const isLoadingDisplay = selectedPage ? loadingPosts : loadingAllPosts;

  // Filter posts by search
  const displayPosts = useMemo(() => {
    if (!searchPost.trim()) return rawPosts;
    return rawPosts.filter(p => {
        const q = searchPost.toLowerCase();
        return (
          (p.message || '').toLowerCase().includes(q) ||
          (p.pageName || '').toLowerCase().includes(q) ||
          (p.id || '').toLowerCase().includes(q)
        );
      });
  }, [rawPosts, searchPost]);

  const visiblePosts = useMemo(
    () => displayPosts.slice(0, visiblePostCount),
    [displayPosts, visiblePostCount]
  );

  useEffect(() => {
    setVisiblePostCount(POST_RENDER_BATCH);
  }, [selectedPage, searchPost]);

  // Filter pages by search
  const filteredPages = useMemo(() => (
    pages.filter(p => p.name.toLowerCase().includes(searchPage.toLowerCase()))
  ), [pages, searchPage]);

  const truncateText = (text, max = 120) => {
    if (!text) return 'Không có nội dung';
    return text.length > max ? text.substring(0, max) + '...' : text;
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  };

  return (
    <div id="page-create-campaign">
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', minHeight: 'calc(100vh - 140px)' }}>
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div className="card-title">Tạo camp từ mã sản phẩm</div>
            <button className="btn btn-g btn-sm" onClick={createCampaignsFromCodes} disabled={creatingCampaigns}>
              {creatingCampaigns ? 'Đang tạo...' : 'Tạo camp'}
            </button>
          </div>
          <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 120px minmax(260px, 1.2fr) 150px 190px 90px 90px', gap: '12px', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tài khoản quảng cáo</label>
              <div className="account-combobox">
                <input
                  type="text"
                  value={accountQuery}
                  onChange={handleAccountInputChange}
                  onFocus={event => {
                    setIsAccountMenuOpen(true);
                    event.target.select();
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setIsAccountMenuOpen(false);
                      setAccountQuery(selectedAccount ? getAccountLabel(selectedAccount) : accountQuery);
                    }, 120);
                  }}
                  onKeyDown={handleAccountInputKeyDown}
                  placeholder="Gõ tên, ví dụ: XK 2 57"
                  autoComplete="off"
                />
                {isAccountMenuOpen && (
                  <div className="account-combobox-menu">
                    {filteredAccountOptions.length > 0 ? (
                      filteredAccountOptions.map(account => (
                        <button
                          key={account._id}
                          type="button"
                          className={`account-combobox-option ${selectedAccountId === account._id ? 'active' : ''}`}
                          onMouseDown={event => {
                            event.preventDefault();
                            selectAccount(account);
                          }}
                        >
                          <span>{account.name}</span>
                          <small>{account.adAccountId}</small>
                        </button>
                      ))
                    ) : (
                      <div className="account-combobox-empty">Không tìm thấy tài khoản</div>
                    )}
                  </div>
                )}
              </div>
              {selectedAccount && (
                <div className="selected-account-pill">
                  Đang chọn: {selectedAccount.name}
                </div>
              )}
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                style={{ display: 'none' }}
                title="Focus vào ô này rồi gõ tên tài khoản, ví dụ XK 2 57"
              >
                <option value="">Chọn tài khoản</option>
                {allAccounts.map(account => (
                  <option key={account._id} value={account._id}>{account.name} - {account.adAccountId}</option>
                ))}
              </select>
              {quickAccountOptions.length > 0 && (
                <div className="quick-account-row" aria-label="Chọn nhanh tài khoản">
                  {quickAccountOptions.map(account => (
                    <button
                      key={account._id}
                      type="button"
                      className={`quick-account-btn ${selectedAccountId === account._id ? 'active' : ''}`}
                      title={`${account.name} - ${account.adAccountId}`}
                      onClick={() => selectAccount(account)}
                    >
                      {account.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Mã nhân viên</label>
              <select value={adNamePrefix} onChange={e => setAdNamePrefix(e.target.value)}>
                {AD_NAME_PREFIX_OPTIONS.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>List mã sản phẩm</label>
              <textarea
                rows="3"
                value={campaignCodes}
                onChange={e => setCampaignCodes(e.target.value)}
                placeholder="Mỗi dòng một mã, ví dụ: XK01"
                style={{ minHeight: '72px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Ngân sách/ngày</label>
              <input
                type="number"
                min="1000"
                step="1000"
                value={dailyBudget}
                onChange={e => setDailyBudget(Number(e.target.value || 0))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Thời gian bắt đầu (giờ VN)</label>
              <input
                type="datetime-local"
                value={campaignStartTime}
                onChange={e => setCampaignStartTime(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tuổi từ</label>
              <input
                type="number"
                min="13"
                max="65"
                value={ageMin}
                onChange={e => setAgeMin(Number(e.target.value || 0))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tuổi đến</label>
              <input
                type="number"
                min="13"
                max="65"
                value={ageMax}
                onChange={e => setAgeMax(Number(e.target.value || 0))}
              />
            </div>
          </div>
          {campaignCreateResult && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--g)', marginBottom: '6px' }}>
                  Đã tạo: {campaignCreateResult.created?.length || 0}
                </div>
                {(campaignCreateResult.created || []).map(item => (
                  <div key={`${item.code}-${item.campaignId}`} style={{ fontSize: '11px', color: 'var(--muted2)', fontFamily: 'var(--mono)', marginBottom: '4px' }}>
                    {item.code} - {item.campaignId} - {item.startTimeDisplay || campaignCreateResult.startTimeDisplay}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--r)', marginBottom: '6px' }}>
                  Lỗi: {campaignCreateResult.errors?.length || 0}
                </div>
                {(campaignCreateResult.errors || []).map(item => (
                  <div key={`${item.code}-${item.error}`} style={{ fontSize: '11px', color: 'var(--muted2)', fontFamily: 'var(--mono)', marginBottom: '4px' }}>
                    {item.code}: {item.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Left: Pages List ── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 140px)' }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div className="card-title">Pages ({filteredPages.length})</div>
            <button className="btn btn-ghost btn-sm" onClick={loadPages} disabled={loadingPages}>
              {loadingPages ? '⟳' : '↺'}
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Tìm tên Page..."
              value={searchPage}
              onChange={e => setSearchPage(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--s3)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'var(--txt)',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>

          {/* "All" button */}
          <div style={{ padding: '4px 8px', flexShrink: 0 }}>
            <div
              onClick={showAllPages}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: !selectedPage ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                border: !selectedPage ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '14px' }}>🌐</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: !selectedPage ? 'var(--b)' : 'var(--txt)' }}>
                  Tất cả Pages
                </div>
                <div style={{ fontSize: '10px', color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>
                  {allPosts.length} bài viết
                </div>
              </div>
            </div>
          </div>

          {/* Pages list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
            {loadingPages ? (
              <div className="empty">
                <span className="spin">⟳</span>
                <p style={{ marginTop: '10px' }}>Đang tải Pages...</p>
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="empty">
                <div className="ei">📄</div>
                <p>Không tìm thấy Page nào</p>
              </div>
            ) : (
              filteredPages.map(page => (
                <div
                  key={page.id}
                  onClick={() => selectPage(page)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginBottom: '4px',
                    background: selectedPage?.id === page.id ? 'rgba(34, 209, 122, 0.1)' : 'transparent',
                    border: selectedPage?.id === page.id ? '1px solid rgba(34, 209, 122, 0.3)' : '1px solid transparent',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => {
                    if (selectedPage?.id !== page.id) {
                      e.currentTarget.style.background = 'var(--s3)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (selectedPage?.id !== page.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {/* Page avatar */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--s3)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: '2px solid var(--border2)'
                  }}>
                    {page.picture?.data?.url ? (
                      <img src={page.picture.data.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>📄</div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: selectedPage?.id === page.id ? 'var(--g)' : 'var(--txt)'
                    }}>
                      {page.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>
                      {page.category || 'Page'} {page.fan_count ? `· ${Number(page.fan_count).toLocaleString()} likes` : ''}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right: Posts ── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 140px)' }}>
          <div className="card-header" style={{ flexShrink: 0 }}>
            <div className="card-title" style={{ gap: '12px' }}>
              <span>{selectedPage ? `Bài viết — ${selectedPage.name}` : 'Tất cả bài viết'}</span>
              <span style={{
                background: 'var(--s3)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontFamily: 'var(--mono)',
                fontSize: '10px',
                color: 'var(--muted2)'
              }}>
                {displayPosts.length} bài
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!selectedPage && (
                <button className="btn btn-ghost btn-sm" onClick={() => loadAllPosts(true)} disabled={loadingAllPosts}>
                  {loadingAllPosts ? '⟳ Đang tải...' : '↺ Cập nhật FB'}
                </button>
              )}
              {selectedPage && (
                <button className="btn btn-ghost btn-sm" onClick={showAllPages}>
                  ← Xem tất cả
                </button>
              )}
            </div>
          </div>

          {/* Search posts */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Tìm bài viết theo nội dung, tên page, ID..."
              value={searchPost}
              onChange={e => setSearchPost(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--s3)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'var(--txt)',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {isLoadingDisplay ? (
              <div className="empty">
                <span className="spin">⟳</span>
                <p style={{ marginTop: '10px' }}>Đang tải bài viết...</p>
              </div>
            ) : displayPosts.length === 0 ? (
              <div className="empty">
                <div className="ei">📝</div>
                <p>Không có bài viết nào</p>
              </div>
            ) : (
              <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                {visiblePosts.map(post => (
                  <div
                    key={post.id}
                    style={{
                      background: 'var(--s2)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      transition: 'border-color 0.15s, transform 0.15s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--border2)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Post image */}
                    {post.picture && (
                      <div style={{
                        width: '100%',
                        height: '160px',
                        background: 'var(--s3)',
                        overflow: 'hidden'
                      }}>
                        <img
                          src={post.picture}
                          alt=""
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}

                    {/* Post content */}
                    <div style={{ padding: '12px 14px' }}>
                      {/* Page name badge (only in "all" mode) */}
                      {!selectedPage && post.pageName && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '8px',
                          paddingBottom: '6px',
                          borderBottom: '1px solid var(--border)'
                        }}>
                          {post.pageAvatar && (
                            <img
                              src={post.pageAvatar}
                              alt=""
                              loading="lazy"
                              style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                            />
                          )}
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--b)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {post.pageName}
                          </span>
                        </div>
                      )}

                      <div style={{
                        fontSize: '12px',
                        lineHeight: '1.5',
                        color: 'var(--txt)',
                        marginBottom: '10px',
                        wordBreak: 'break-word'
                      }}>
                        {truncateText(post.message)}
                      </div>

                      {/* Engagement stats */}
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        fontSize: '11px',
                        color: 'var(--muted2)',
                        marginBottom: '8px'
                      }}>
                        <span>👍 {post.likes}</span>
                        <span>💬 {post.comments}</span>
                        <span>🔄 {post.shares}</span>
                      </div>

                      {/* Date & link */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid var(--border)',
                        paddingTop: '8px',
                        marginTop: '4px'
                      }}>
                        <span style={{
                          fontSize: '10px',
                          color: 'var(--muted)',
                          fontFamily: 'var(--mono)'
                        }}>
                          {formatDate(post.createdTime)}
                        </span>
                        {post.permalink && (
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '10px',
                              color: 'var(--b)',
                              textDecoration: 'none',
                              fontWeight: 600
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            Xem trên FB ↗
                          </a>
                        )}
                      </div>

                      {/* Post ID */}
                      <div style={{
                        marginTop: '6px',
                        fontSize: '10px',
                        fontFamily: 'var(--mono)',
                        color: 'var(--muted)',
                        background: 'var(--s3)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        userSelect: 'all'
                      }}>
                        ID: {post.id}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {visiblePosts.length < displayPosts.length && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setVisiblePostCount(count => count + POST_RENDER_BATCH)}
                  >
                    Xem thêm {Math.min(POST_RENDER_BATCH, displayPosts.length - visiblePosts.length)} bài
                  </button>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
