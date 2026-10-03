import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowDownUp, ArrowRight, AudioLines, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Cpu, Database, Disc3, Fan, Headphones,
  Heart, House, Keyboard, Menu, MessageCircle, Monitor, Mouse, Network, PanelTop,
  Search, Send, ShieldCheck, ShoppingBag, ShoppingCart, SlidersHorizontal,
  Sparkles, X, Zap,
} from 'lucide-react';
import './styles.css';
import { interpretRequest, isPcBuildIntent } from '../shared/request.js';

const CATEGORIES = [
  { label: 'Todos os produtos', slug: 'todos', Icon: House },
  { label: 'PC Gamer', slug: 'pc-gamer', Icon: PanelTop },
  { label: 'PC Gamer completo', slug: 'pc-gamer-completo', Icon: Monitor },
  { label: 'Placas de vídeo', slug: 'placas-de-video', Icon: Cpu },
  { label: 'Headsets', slug: 'headsets', Icon: Headphones },
  { label: 'Teclados', slug: 'teclados', Icon: Keyboard },
  { label: 'Mouses', slug: 'mouses', Icon: Mouse },
  { label: 'Caixas de som', slug: 'caixas-de-som', Icon: AudioLines },
  { label: 'Monitores', slug: 'monitores', Icon: Monitor },
];
const PANELS = [
  { key: 'database', title: 'Banco SQLite', Icon: Database },
  { key: 'model', title: 'API do modelo', Icon: Zap },
  { key: 'runs', title: 'Execuções RAG', Icon: Activity },
];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compactMoney = (value) => money.format(Number(value || 0)).replace(',00', '');

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'O pedido não foi concluído. Tente outra vez.');
  return payload;
}

function BrandMark({ className = '' }) {
  return (
    <div className={'brand-lockup ' + className}>
      <picture><source media="(max-width: 570px)" srcSet="/assets/setupninja-logo-white-mobile.webp" />
        <img className="brand-logo" src="/assets/setupninja-logo-white.webp" alt="" /></picture>
    </div>
  );
}

function Artifact({ product }) {
  const [broken, setBroken] = useState(false);
  if (product.image_url && !broken) {
    return (
      <div className="product-visual">
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
        <div className="product-microbrand"><BrandMark /></div>
      </div>
    );
  }
  const Icon = product.category.toLowerCase().includes('placa') ? Cpu
    : product.category.toLowerCase().includes('head') ? Headphones
      : product.category.toLowerCase().includes('tecl') ? Keyboard
        : product.category.toLowerCase().includes('mouse') ? Mouse
          : product.category.toLowerCase().includes('monitor') ? Monitor
            : product.category.toLowerCase().includes('caixa') ? AudioLines
              : product.category.toLowerCase().includes('mem') ? Disc3
                : product.category.toLowerCase().includes('cooler') ? Fan : PanelTop;
  return (
    <div className={'product-visual product-artwork art-' + product.category.toLowerCase().replace(/[^a-z]/g, '').slice(0, 7)}>
      <span className="artwork-grid" aria-hidden="true" />
      <span className="artwork-product"><Icon size={72} strokeWidth={1.05} aria-hidden="true" /></span>
      <span className="artwork-caption"><BrandMark /><small>HARDWARE QUE ENTREGA</small></span>
    </div>
  );
}

function OperatorBar({ active, onChange, session }) {
  return (
    <header className="operator-bar">
      <div className="operator-brand">
        <span className="operator-mini-icon"><Zap size={14} fill="currentColor" /></span>
        <span>SETUP NINJA <b>STUDIO</b></span>
        <span className="build-divider" aria-hidden="true" />
        <span className="operator-caption">AMBIENTE DE DEMONSTRAÇÃO</span>
      </div>
      <nav className="operator-tools" aria-label="Ferramentas da demonstração">
        {PANELS.map(({ key, title, Icon }) => (
          <button
            className={'operator-tab' + (active === key ? ' selected' : '')}
            onClick={() => onChange(active === key ? '' : key)}
            aria-pressed={active === key}
            key={key}
          >
            <Icon size={15} />
            <span>{title}</span>
            {key === 'database' ? <i className="tool-count">{session?.database?.products || '—'}</i> : null}
            {key === 'model' ? <i className={'tool-status' + (session?.providerConfigured ? ' linked' : '')} /> : null}
          </button>
        ))}
        <span className="demo-pill"><span />DEMONSTRAÇÃO</span>
      </nav>
      <button className="operator-menu" aria-label="Abrir ferramentas" onClick={() => onChange(active === 'menu' ? '' : 'menu')}>
        <Menu size={19} />
      </button>
    </header>
  );
}

function Header({ onSearch, onCart, cartCount }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <div className="store-promo">
        <span className="promo-mark"><Sparkles size={12} fill="currentColor" /></span>
        <strong>OFERTA NINJA</strong>
        <span>Estoque oficial consultado · preços do catálogo.</span>
        <a href="https://www.setupninja.com.br/computadores" target="_blank" rel="noreferrer">
          Confira <ArrowRight size={13} />
        </a>
      </div>
      <header className="store-header">
        <button className="mobile-menu" aria-label="Abrir menu de departamentos" onClick={() => setMenuOpen(!menuOpen)}>
          <Menu />
        </button>
        <a href="#inicio" className="brand-link" aria-label="Setup Ninja — início"><BrandMark /></a>
        <form className="store-search" onSubmit={(event) => {
          event.preventDefault();
          onSearch(event.currentTarget.elements.query.value);
          document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' });
        }}>
          <Search size={19} aria-hidden="true" />
          <input name="query" placeholder="Olá, o que você procura?" aria-label="Buscar produtos" />
          <span className="search-hint">PC gamer, memória, teclado...</span>
          <button type="submit" aria-label="Buscar"><ArrowRight size={16} /></button>
        </form>
        <div className="store-utilities">
          <div className="utility-item account-utility">
            <span className="utility-icon"><ShieldCheck size={18} /></span>
            <span>Bem-vindo ninja <strong>Minha conta</strong></span>
          </div>
          <button className="utility-item cart-utility" onClick={onCart} aria-label={`Abrir carrinho com ${cartCount} itens`}>
            <span className="utility-icon cart-icon"><ShoppingBag size={19} /><i>{cartCount}</i></span>
            <span>Seu carrinho <strong>Ver sacola</strong></span>
          </button>
        </div>
      </header>
      <nav className={'store-departments' + (menuOpen ? ' menu-open' : '')} aria-label="Departamentos">
        <div className="department-inner">
          <button className="all-departments" onClick={() => setMenuOpen(!menuOpen)}>
            <Menu size={16} />DEPARTAMENTOS<ChevronDown size={12} />
          </button>
          <a href="#vitrine">PC Gamer</a>
          <a href="#vitrine">Hardware <ChevronDown size={12} /></a>
          <a href="#vitrine">Periféricos <ChevronDown size={12} /></a>
          <a href="#vitrine">Monitores</a>
          <a href="#vitrine">Novidades</a>
          <a href="#vitrine">Ofertas</a>
          <button className="build-pc-link" onClick={() => window.dispatchEvent(new Event('open-pc-builder'))}><Cpu size={15} /> MONTE SEU PC <ArrowRight size={13} /></button>
        </div>
        {menuOpen ? (
          <div className="department-flyout">
            <div><strong>Computadores</strong><a href="#vitrine">PC Gamer</a><a href="#vitrine">Setup gamer completo</a><a href="#vitrine">Workstation</a></div>
            <div><strong>Hardware</strong><a href="#vitrine">Processadores</a><a href="#vitrine">Placas de vídeo</a><a href="#vitrine">Memória RAM</a><a href="#vitrine">SSD e armazenamento</a></div>
            <div><strong>Periféricos</strong><a href="#vitrine">Headsets</a><a href="#vitrine">Teclados e mouses</a><a href="#vitrine">Monitores</a><a href="#vitrine">Cadeiras</a></div>
          </div>
        ) : null}
      </nav>
    </>
  );
}

function Hero({ onChooseCategory }) {
  return (
    <section className="hero" id="inicio">
      <div className="hero-copy">
        <div className="hero-overline"><span />SEU PRÓXIMO NÍVEL COMEÇA AQUI</div>
        <h1>O setup que você<br />imagina. <em>O ninja monta.</em></h1>
        <p>Peças escolhidas a dedo. Configurações de verdade. Seu jogo, elevado.</p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => onChooseCategory('PC Gamer')}>Explorar PC gamer <ArrowRight size={16} /></button>
          <button className="secondary-button" onClick={() => onChooseCategory('todos')}>Ver todos os produtos</button>
        </div>
        <div className="hero-promises">
          <span><ShieldCheck size={15} /> Compra segura</span>
          <i />
          <span><Zap size={15} /> 17 departamentos sincronizados</span>
          <i />
          <span><Sparkles size={15} /> Preço do catálogo</span>
        </div>
      </div>
      <div className="hero-art">
        <span className="hero-aura" aria-hidden="true" />
        <span className="hero-orbit orbit-one" aria-hidden="true" />
        <span className="hero-orbit orbit-two" aria-hidden="true" />
        <span className="hero-pixel pixel-one" aria-hidden="true" />
        <span className="hero-pixel pixel-two" aria-hidden="true" />
        <div className="hero-image-shell">
          <img
            src="https://cdn.dooca.store/174137/products/9004816i1-abkll.jpg?v=1774642276"
            alt="PC Gamer Setup Ninja com processador AMD Ryzen 5"
            onError={(event) => { event.currentTarget.style.opacity = '0'; }}
          />
        </div>
        <div className="hero-spec"><span><Cpu size={17} /></span><span><strong>RYZEN 5</strong><small>POTÊNCIA PRONTA</small></span><b>01</b></div>
        <div className="hero-offer"><strong>CATÁLOGO</strong><span>ESTOQUE<br />CONSULTADO</span></div>
        <span className="hero-grid-label">SN — 05 / 2026</span>
      </div>
      <div className="hero-pagination" aria-label="Slide 1 de 3">
        <span className="active" /><span /><span />
        <span className="pagination-label">OFERTAS MONTADAS PARA JOGAR</span>
      </div>
    </section>
  );
}

function BenefitBar() {
  return (
    <div className="benefit-strip">
      <div className="benefit">
        <span className="benefit-icon"><Zap size={17} /></span>
        <span><strong>Preço publicado</strong><small>Sem condição de pagamento presumida</small></span>
      </div>
      <div className="benefit">
        <span className="benefit-icon"><ShoppingCart size={17} /></span>
        <span><strong>Estoque por produto</strong><small>Quantidade informada pela loja</small></span>
      </div>
      <div className="benefit">
        <span className="benefit-icon"><ShieldCheck size={17} /></span>
        <span><strong>Compra segura</strong><small>Loja especializada em tecnologia</small></span>
      </div>
      <button className="benefit assistant-promo" onClick={() => window.dispatchEvent(new Event('open-ninja-chat'))}>
        <span className="benefit-icon benefit-sparkle"><Sparkles size={17} /></span>
        <span><strong>Não sabe o que escolher?</strong><small>Pergunte para o NinjaRUDEUS <ArrowRight size={12} /></small></span>
      </button>
    </div>
  );
}

function CategoryRail({ selected, onSelect }) {
  return (
    <div className="category-rail" aria-label="Escolha uma categoria">
      {CATEGORIES.map(({ label, slug, Icon }) => (
        <button
          key={slug}
          className={'category-choice' + (selected === slug ? ' active' : '')}
          onClick={() => onSelect(slug)}
          aria-pressed={selected === slug}
        >
          <span className="category-icon"><Icon size={19} strokeWidth={1.8} /></span>
          <span>{label}</span>
          <ChevronRight className="category-arrow" size={13} />
        </button>
      ))}
    </div>
  );
}

function ProductCard({ product, index, onAdd }) {
  const [saved, setSaved] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const pct = Number.isFinite(product.price_brl) && Number.isFinite(product.list_price_brl)
    ? Math.max(0, Math.round((1 - product.price_brl / product.list_price_brl) * 100)) : 0;
  return (
    <article className="product-card">
      <div className="product-card-media">
        {pct ? <span className="discount-tag">{pct}% OFF</span> : null}
        {product.image_url && !imageBroken ? (
          <div className="product-photo"><img src={product.image_url} alt={product.name} loading={index < 6 ? 'eager' : 'lazy'} onError={() => setImageBroken(true)} /></div>
        ) : <Artifact key={product.id + '-image'} product={product} />}
        <button className={'save-product' + (saved ? ' saved' : '')} aria-label={saved ? 'Remover dos favoritos' : 'Salvar nos favoritos'} onClick={() => setSaved(!saved)}>
          <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="product-card-content">
        <span className="product-category">{product.category}</span>
        <h3>{product.name}</h3>
        <div className="product-spacer" />
        {Number.isFinite(product.price_brl) ? (
          <>
            {Number.isFinite(product.list_price_brl) ? <span className="old-price">{compactMoney(product.list_price_brl)}</span> : null}
            <p className="pix-price"><strong>{compactMoney(product.price_brl)}</strong><span> preço publicado</span></p>
            {Number.isFinite(product.installment_price_brl) && product.installments ? (
              <p className="installment-price">ou <b>{product.installments}x</b> de <b>{compactMoney(product.installment_price_brl)}</b> sem juros</p>
            ) : null}
          </>
        ) : <p className="no-price">Preço individual não encontrado</p>}
        {Number.isFinite(product.price_brl) && Number.isFinite(product.stock_quantity) && product.stock_quantity > 0 ? <button className="add-cart" onClick={() => onAdd(product)}><ShoppingBag size={15} /> Colocar no carrinho</button>
          : /^https:\/\/(?:www\.)?setupninja\.com\.br\//i.test(product.product_url || '')
            ? <a className="add-cart" href={product.product_url} target="_blank" rel="noreferrer">Ver na loja oficial <ArrowRight size={13} /></a>
            : <button className="add-cart" disabled title={Number.isFinite(product.price_brl) ? 'Este item não tem estoque disponível no catálogo' : 'Este item não tem preço individual no catálogo'}>{Number.isFinite(product.price_brl) ? 'Sem estoque disponível' : 'Preço indisponível'}</button>}
      </div>
    </article>
  );
}

function ChatBubble({ children, role, citations }) {
  const assistant = role === 'assistant';
  return (
    <div className={'chat-row ' + (assistant ? 'assistant-row' : 'customer-row')}>
      {assistant ? <span className="chat-avatar" aria-label="NinjaRUDEUS"><BrandMark /></span> : null}
      <div className="chat-bubble-group">
        <div className={'chat-name' + (assistant ? '' : ' customer-name')}>{assistant ? 'NINJARUDEUS' : 'VOCÊ'}{assistant ? <span>NA BANCADA</span> : null}</div>
        <div className={'chat-bubble ' + (assistant ? 'assistant-bubble' : 'customer-bubble')}>{children}</div>
        {assistant && citations?.length ? (
          <div className="answer-sources">
            {citations.slice(0, 2).map((item) => (
              <a key={item.url} href={item.url} target="_blank" rel="noreferrer">
                <span>FONTE</span><span>{item.title}</span><ArrowRight size={11} />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChatWidget({ open, setOpen, setPanel, panel }) {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([
    { id: 'welcome', role: 'assistant', content: 'Salve! Sou o NinjaRUDEUS. Pergunta sobre PC, peça ou aquele jogo que está fazendo tua máquina implorar por misericórdia.' },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastBuildId, setLastBuildId] = useState('');
  useEffect(() => {
    api('/api/session').then((data) => setStatus(data)).catch(() => setStatus(null));
    api('/api/build/history').then((data) => { if (data.builds?.[0]?.id) setLastBuildId(data.builds[0].id); }).catch(() => {});
    const handler = () => setOpen(true);
    window.addEventListener('open-ninja-chat', handler);
    return () => window.removeEventListener('open-ninja-chat', handler);
  }, [setOpen]);
  useEffect(() => {
    if (open) requestAnimationFrame(() => document.getElementById('chat-composer')?.focus());
  }, [open]);

  async function sendMessage(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setDraft('');
    setError('');
    setBusy(true);
    setMessages((list) => [...list, { id: crypto.randomUUID(), role: 'user', content: message }]);
    try {
      const buildIntent = isPcBuildIntent(message, Boolean(lastBuildId));
      const result = buildIntent
        ? await api('/api/build', { method: 'POST', body: JSON.stringify({ request: message, previousBuildId: lastBuildId || undefined }) })
        : await api('/api/chat', { method: 'POST', body: JSON.stringify({ message }) });
      if (buildIntent && result.clarification) {
        setMessages((list) => [...list, { id: crypto.randomUUID(), role: 'assistant', content: result.answer }]);
        return;
      }
      const built = buildIntent && result.selected;
      const citations = built ? result.selected.items.map((item) => ({ id: item.id, productId: item.id, title: item.name, category: item.category, url: item.url || item.sourceUrl })) : result.citations;
      const answer = built ? `${result.selected.explanation}\n\nPeças e preços conferidos no catálogo oficial. Total: ${money.format(result.selected.totalPriceCents / 100)}.` : result.answer;
      setMessages((list) => [...list, {
        id: crypto.randomUUID(), role: 'assistant',
        content: answer, citations, telemetry: built ? { ...result.telemetry, mode: 'pc_builder', model: result.generation.model || result.decision.model } : result.telemetry,
      }]);
      if (built) setLastBuildId(result.buildId);
      if (!built) setStatus((value) => value ? { ...value, providerConfigured: result.telemetry.mode === 'api_openai_compatível' } : value);
      window.dispatchEvent(new Event('ninja-runs-changed'));
      if (!built && result.telemetry.mode.includes('fallback')) setError('A API não respondeu. O modo local respondeu usando o catálogo.');
    } catch (reason) {
      setError(reason.message);
      setMessages((list) => list.filter((item) => item.role !== 'user' || item.content !== message));
      setDraft(message);
    } finally { setBusy(false); }
  }

  return (
    <>
      {open ? <button className="chat-scrim" aria-label="Fechar atendimento" onClick={() => setOpen(false)} /> : null}
      <button className={'chat-launcher' + (open ? ' launcher-open' : '')} onClick={() => setOpen(!open)} aria-label={open ? 'Fechar chat NinjaRUDEUS' : 'Perguntar para o NinjaRUDEUS'}>
        {open ? <X size={20} /> : <><MessageCircle size={19} /><span>Fala com o Ninja</span><i /></>}
      </button>
      <section className={'chat-window' + (open ? ' visible' : '')} aria-label="Atendimento NinjaRUDEUS">
        <header className="chat-header">
          <span className="chat-header-mark"><BrandMark /></span>
          <span className="chat-title"><strong>O Ninja está na área</strong><small><i /> NinjaRUDEUS · especialista em hardware</small></span>
          <button aria-label="Ver execuções RAG" title="Inspecionar execuções RAG" onClick={() => { setOpen(false); setPanel(panel === 'runs' ? '' : 'runs'); }}><Activity size={16} /></button>
          <button aria-label="Fechar chat" onClick={() => setOpen(false)}><X size={18} /></button>
        </header>
        <div className="chat-privacy">
          <ShieldCheck size={13} /> Suas conversas ficam nesta sessão por até 24 horas.
          {status?.providerConfigured ? <span className="chat-api-badge">API {status.model}</span> : <span className="chat-local-badge">MODO DEMONSTRAÇÃO</span>}
        </div>
        <div className="chat-messages" id="chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
          <div className="chat-session-note"><span /> NOVA SESSÃO · PERGUNTAS DE TECNOLOGIA</div>
          {messages.map((message) => (
            <ChatBubble key={message.id} role={message.role} citations={message.citations}>
              {message.content}
            </ChatBubble>
          ))}
          {busy ? (
            <div className="chat-row assistant-row typing-row">
              <span className="chat-avatar"><BrandMark /></span>
              <div className="typing-bubble"><span /><span /><span /><small>O Ninja está verificando o estoque... quer dizer, as fontes.</small></div>
            </div>
          ) : null}
        </div>
        <div className="chat-bottom">
          {error ? <div role="alert" className="chat-error">{error}</div> : null}
          {messages.length < 3 ? (
            <div className="suggested-prompts">
              <button onClick={() => setDraft('Monte um PC gamer até R$ 4.000')}>PC até R$ 4.000?</button>
              <button onClick={() => setDraft('Qual é a diferença entre os headsets?')}>Comparar headsets</button>
            </div>
          ) : null}
          <form className="chat-input-row" onSubmit={sendMessage}>
            <input id="chat-composer" autoComplete="off" maxLength={1200} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Pergunte ao ninja sobre hardware..." aria-label="Pergunte ao NinjaRUDEUS" disabled={busy} />
            <button className="send-button" disabled={busy || !draft.trim()} aria-label="Enviar pergunta">
              {busy ? <span className="mini-loader" /> : <Send size={16} />}
            </button>
          </form>
          <div className="chat-footer">
            <button onClick={async () => {
              try { await api('/api/chat/clear', { method: 'POST', body: JSON.stringify({}) }); } catch { /* Keep the local UI responsive if the server is unavailable. */ }
              setMessages([{ id: 'welcome-reset', role: 'assistant', content: 'Sessão limpa. Manda a próxima dúvida de hardware quando quiser.' }]);
            }}>Limpar conversa</button>
            <span><ShieldCheck size={11} /> FONTES DO CATÁLOGO NA RESPOSTA</span>
          </div>
        </div>
      </section>
    </>
  );
}

function DatabasePanel() {
  const [info, setInfo] = useState(null);
  const [table, setTable] = useState('products');
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([api('/api/inspect/tables'), api('/api/inspect/report')]).then(([result, scrape]) => {
      if (!active) return;
      setInfo(result);
      setReport(scrape);
      if (result.tables.length) setTable(result.tables[0].name);
    }).catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!table) return undefined;
    let active = true;
    api('/api/inspect/table/' + encodeURIComponent(table) + '?limit=25&offset=' + (page * 25))
      .then((result) => active && setData(result))
      .catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, [table, page]);
  const selected = info?.tables?.find((item) => item.name === table);
  const pageCount = data ? Math.max(1, Math.ceil(data.total / 25)) : 1;
  return (
    <div className="panel-content">
      <div className="panel-intro">
        <span className="panel-icon"><Database size={18} /></span>
        <span><h2>Banco de dados</h2><p>Catálogo SQL e fontes recuperadas pelo RAG.</p></span>
        <button className="panel-close" onClick={() => window.dispatchEvent(new Event('close-inspector'))} aria-label="Fechar painel"><X size={17} /></button>
      </div>
      <div className="db-file-status">
        <span className="sqlite-indicator" />
        <span><strong>SQLite · arquivo local</strong><small>{info?.database?.databaseFile || 'data/setupninja.sqlite'} · persistente</small></span>
        <span className="db-mode">SOMENTE LEITURA</span>
      </div>
      {info ? (
        <div className="db-summary">
          <span><b>{info.database.products}</b><small>produtos</small></span>
          <span><b>{info.database.categories.length}</b><small>departamentos</small></span>
          <span><b>{info.database.chunks}</b><small>chunks de conhecimento</small></span>
        </div>
      ) : null}
      <div className="panel-section-heading"><h3>TABELAS <span>{info?.tables.length || '—'}</span></h3><span>INSPECIONE A ESTRUTURA REAL</span></div>
      <div className="table-picker">
        {(info?.tables || []).map((item) => (
          <button key={item.name} className={table === item.name ? 'selected' : ''} onClick={() => { setTable(item.name); setPage(0); }}>
            <span>{item.name}</span><i>{item.rows}</i>
          </button>
        ))}
      </div>
      <div className="table-columns">{(selected?.columns || []).map((column) => (
        <span key={column.name}>{column.name}<i>{column.type || 'TEXT'}</i></span>
      ))}</div>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      <div className="sql-preview">
        {data?.rows?.length ? (
          <table className="data-table">
            <thead><tr>{Object.keys(data.rows[0]).slice(0, 5).map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>{data.rows.map((row, index) => (
              <tr key={index}>{Object.keys(row).slice(0, 5).map((column) => {
                const value = row[column];
                return <td key={column} title={String(value ?? '')}>{value == null ? <i>nulo</i> : String(value).slice(0, 94)}</td>;
              })}</tr>
            ))}</tbody>
          </table>
        ) : <div className="empty-data">{table ? 'Carregando tabela…' : 'As tabelas aparecem aqui.'}</div>}
      </div>
      <div className="table-pagination">
        <span>{data ? 'REGISTROS ' + (data.offset + 1) + '–' + Math.min(data.offset + data.rows.length, data.total) + ' DE ' + data.total : 'AGUARDANDO SQLITE'}</span>
        <button disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))} aria-label="Página anterior"><ChevronLeft size={15} /></button>
        <span>{page + 1} / {pageCount}</span>
        <button disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)} aria-label="Próxima página"><ChevronRight size={15} /></button>
      </div>
      <details className="scrape-coverage">
        <summary><span>Relatório do catálogo <span className="coverage-tag">FONTE OFICIAL</span></span><ChevronDown size={15} /></summary>
        {report ? (
          <div className="coverage-body">
            <p>{report.method}</p>
            <p>{report.coverage_note}</p>
            <ul>{report.categories_verified_in_store_departments?.map((category) => <li key={category}>{category} <span>API oficial consultada</span></li>)}</ul>
            <a href={report.store} target="_blank" rel="noreferrer">Abrir Setup Ninja <ArrowRight size={12} /></a>
          </div>
        ) : null}
      </details>
      <div className="panel-footnote"><ShieldCheck size={13} /> Conversas e execuções de IA só aparecem para esta sessão do navegador.</div>
    </div>
  );
}

function ModelPanel({ session, onConnected, onRefreshRuns }) {
  const [initial, setInitial] = useState(null);
  const [model, setModel] = useState('gpt-4o-mini');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [provider, setProvider] = useState('openai');
  const [key, setKey] = useState('');
  const [jevConfigured, setJevConfigured] = useState(false);
  const [jevKey, setJevKey] = useState('');
  const [jevMessage, setJevMessage] = useState('');
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState(false);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    Promise.all([api('/api/model/config'), api('/api/decision/config')]).then(([config, decision]) => {
      setInitial(config.configured);
      setModel(config.model || 'gpt-4o-mini');
      setBaseUrl(config.baseUrl || 'https://api.openai.com/v1');
      setProvider(config.provider || 'openai');
      setJevConfigured(decision.configured);
    }).catch((error) => { setFailure(true); setMessage(error.message); });
  }, []);
  const configured = initial ?? session?.providerConfigured;
  async function connect(event) {
    event.preventDefault();
    setMessage('');
    setPending('connect');
    try {
      const result = await api('/api/model/config', {
        method: 'POST', body: JSON.stringify({ model, baseUrl, apiKey: key, provider }),
      });
      setKey('');
      setInitial(true);
      setMessage(result.note);
      await onConnected();
    } catch (error) { setFailure(true); setMessage(error.message); }
    finally { setPending(''); }
  }
  async function connectJev(event) {
    event.preventDefault();
    setPending('jev'); setJevMessage('');
    try {
      const result = await api('/api/decision/config', { method: 'POST', body: JSON.stringify({ apiKey: jevKey }) });
      setJevKey(''); setJevConfigured(result.configured); setJevMessage(result.configured ? result.note : 'Decisão Jev desligada; o ranking determinístico continua ativo.');
    } catch (error) { setFailure(true); setJevMessage(error.message); }
    finally { setPending(''); }
  }
  async function runConnectionTest() {
    setTesting(true);
    setMessage('');
    setFailure(false);
    try {
      const response = await api('/api/model/test', { method: 'POST', body: JSON.stringify({}) });
      setMessage('Conexão verificada · ' + response.model + ' respondeu OK.');
      onRefreshRuns();
    } catch (error) { setFailure(true); setMessage(error.message); }
    finally { setTesting(false); }
  }
  async function disconnect() {
    setPending('disconnect');
    try {
      await api('/api/model/disconnect', { method: 'POST', body: JSON.stringify({}) });
      setInitial(false);
      setKey('');
      setMessage('Chave removida da memória desta sessão. O modo demonstrativo segue funcionando.');
      onConnected();
    } catch (error) { setFailure(true); setMessage(error.message); }
    finally { setPending(''); }
  }
  return (
    <div className="panel-content">
      <div className="panel-intro">
        <span className="panel-icon panel-icon-accent"><Zap size={18} /></span>
        <span><h2>Conexão com IA</h2><p>O modelo responde com evidências da loja.</p></span>
        <button className="panel-close" onClick={() => window.dispatchEvent(new Event('close-inspector'))} aria-label="Fechar painel"><X size={17} /></button>
      </div>
      <div className={'connection-card' + (configured ? ' is-connected' : '')}>
        <span className="connection-indicator" />
        <span><strong>{configured ? 'Modelo pronto para responder' : 'Modo demonstração local'}</strong>
          <small>{configured ? model + ' · ' + provider + (key ? ' · chave somente em memória' : ' · endpoint local') : 'Prévia determinística · nenhuma chamada de LLM'}</small></span>
        <span className={'connection-status' + (configured ? ' online' : '')}>{configured ? 'ATIVO' : 'LOCAL'}</span>
      </div>
      <div className="panel-section-heading"><h3>MODELO DE CONVERSA</h3><span>ACESSO POR ESTA SESSÃO</span></div>
      <form className="llm-form" onSubmit={connect}>
        <label htmlFor="llm-provider">Provedor</label>
        <select id="llm-provider" value={provider} onChange={(event) => {
          const next = event.target.value; setProvider(next);
          if (next === 'openai') { setBaseUrl('https://api.openai.com/v1'); setModel('gpt-4o-mini'); }
          if (next === 'ollama') { setBaseUrl('http://host.docker.internal:11434/v1'); setModel('llama3.1'); }
          if (next === 'lmstudio') { setBaseUrl('http://host.docker.internal:1234/v1'); setModel('local-model'); }
          if (next === 'openai-compatible') { setBaseUrl(''); setModel(''); }
        }}><option value="openai">OpenAI</option><option value="ollama">Ollama local</option><option value="lmstudio">LM Studio local</option><option value="openai-compatible">OpenAI compatível (HTTPS)</option></select>
        <label htmlFor="llm-base-url">URL base <span>{provider === 'ollama' || provider === 'lmstudio' ? 'ALLOWLIST DO SERVIDOR' : 'HTTPS'}</span></label>
        <input id="llm-base-url" type="url" spellCheck="false" autoComplete="off" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required />
        <label htmlFor="llm-model">Modelo</label>
        <input id="llm-model" autoComplete="off" value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-4o-mini" required />
        <label htmlFor="llm-key">Chave da API <span>{provider === 'ollama' || provider === 'lmstudio' ? 'OPCIONAL' : 'SEGREDO'}</span></label>
        <div className="secret-input"><input id="llm-key" type="password" autoComplete="new-password" spellCheck="false" value={key} onChange={(event) => { setKey(event.target.value); setFailure(false); setMessage(''); }} placeholder={configured ? 'Chave mantida nesta sessão' : 'Não informado'} required={!configured && provider !== 'ollama' && provider !== 'lmstudio'} /><ShieldCheck size={16} /></div>
        <div className="secret-notice"><ShieldCheck size={14} /><span>Chaves ficam <b>somente em memória</b>, nesta sessão. Nunca entram no SQLite ou logs. Conexão local exige endpoint liberado pelo administrador; o navegador usa o servidor, não o PC de quem visita.</span></div>
        {message ? <div role={failure ? 'alert' : 'status'} className={'connection-message' + (failure ? ' failure' : '')}>{failure ? <CircleHelp size={14} /> : <Check size={14} />}{message}</div> : null}
        <button className="connect-button" type="submit" disabled={pending === 'connect'}>
          {pending === 'connect' ? <span className="mini-loader" /> : <Zap size={15} />}
          {configured ? 'Atualizar conexão' : 'Conectar ao modelo'}
        </button>
      </form>
      {configured ? (
        <div className="connected-actions">
          <button onClick={runConnectionTest} disabled={testing}>{testing ? <span className="mini-loader" /> : <Activity size={15} />}{testing ? 'Testando…' : 'Testar conexão'}</button>
          <button onClick={disconnect} disabled={pending === 'disconnect'}><X size={14} />Desconectar</button>
        </div>
      ) : null}
      <div className="panel-section-heading chat-mode-title"><h3>DECISÕES OPCIONAIS · TYPESAFE JEV</h3><span>{jevConfigured ? 'CONECTADO' : 'NÃO CONFIGURADO'}</span></div>
      <p className="jev-note">Jev escolhe somente entre montagens já validadas e dentro do orçamento. Ele não escreve a resposta; a explicação vem do modelo de conversa ou do montador local.</p>
      <form className="llm-form" onSubmit={connectJev}>
        <label htmlFor="jev-key">Chave Typesafe <span>SESSÃO</span></label>
        <div className="secret-input"><input id="jev-key" type="password" autoComplete="new-password" spellCheck="false" value={jevKey} onChange={(event) => setJevKey(event.target.value)} placeholder={jevConfigured ? 'Chave mantida nesta sessão' : 'Sem chave: fallback determinístico'} /><ShieldCheck size={16} /></div>
        {jevMessage ? <div role="status" className="connection-message">{jevMessage}</div> : null}
        <button className="connect-button" disabled={pending === 'jev'}><Zap size={14} />{jevConfigured ? 'Atualizar Jev' : 'Conectar Jev opcional'}</button>
      </form>
      <div className="panel-section-heading chat-mode-title"><h3>COMO AS RESPOSTAS FUNCIONAM</h3><span>RAG LOCAL</span></div>
      <div className="model-flow">
        <span><Search size={15} /><b>Sua pergunta</b></span><ArrowRight size={13} />
        <span><Database size={15} /><b>Busca FTS5</b></span><ArrowRight size={13} />
        <span><Sparkles size={15} /><b>NinjaRUDEUS</b></span>
      </div>
      <div className="knowledge-card"><span><ShieldCheck size={16} /></span>
        <p><strong>Contexto com limites claros.</strong> A IA recebe apenas os trechos encontrados no catálogo e responde sobre tecnologia. Produto desconhecido? O ninja admite a falta de dados.</p>
      </div>
      <div className="panel-footnote"><ShieldCheck size={13} /> Cada navegador recebe uma chave isolada; após uma hora, ela sai da memória.</div>
    </div>
  );
}

function RunsPanel() {
  const [runs, setRuns] = useState([]);
  const [failure, setFailure] = useState('');
  const load = () => Promise.all([api('/api/chat/runs'), api('/api/build/history')]).then(([rag, history]) => {
    const builds = history.builds.map((build) => ({
      id: `build-${build.id}`, created_at: build.created_at, query: build.request_text || 'Montagem anterior',
      kind: 'build', mode: build.generation?.called && !build.generation?.fallback ? 'montagem · LLM' : 'montagem · local',
      model_name: build.generation_model, answer: build.explanation, outcome: build.compatibility.status,
      sources: Object.values(build.parts).flatMap((value) => Array.isArray(value) ? value : value ? [value] : [])
        .map((part) => ({ id: part.id, title: part.name, category: part.categoryName || part.category,
          url: part.productUrl || part.sourceUrl, score: null })),
      retrieved_count: Object.values(build.parts).flatMap((value) => Array.isArray(value) ? value : value ? [value] : []).length,
      input_tokens: build.generation?.inputTokens ?? null, output_tokens: build.generation?.outputTokens ?? null,
      interpretation: build.interpretation, decision: build.decision, generation: build.generation,
    }));
    setRuns([...rag.runs.map((run) => ({ ...run, kind: 'rag' })), ...builds]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 30));
    setFailure('');
  }).catch((error) => setFailure(error.message));
  useEffect(() => {
    load();
    window.addEventListener('ninja-runs-changed', load);
    return () => window.removeEventListener('ninja-runs-changed', load);
  }, []);
  const modes = useMemo(() => [...new Set(runs.map((run) => run.mode))], [runs]);
  return (
    <div className="panel-content runs-content">
      <div className="panel-intro">
        <span className="panel-icon"><Activity size={18} /></span>
        <span><h2>Execuções e respostas</h2><p>Busca RAG e montagens desta sessão.</p></span>
        <button className="panel-close" onClick={() => window.dispatchEvent(new Event('close-inspector'))} aria-label="Fechar painel"><X size={17} /></button>
      </div>
      <div className="runs-metrics">
        <div><strong>{runs.length}</strong><span>EXECUÇÕES NA SESSÃO</span></div>
        <div><strong>{modes.length || '0'}</strong><span>MODOS ATIVADOS</span></div>
        <button onClick={load} aria-label="Atualizar execuções"><ArrowDownUp size={16} /></button>
      </div>
      <div className="panel-section-heading"><h3>TRILHA DE ATENDIMENTO</h3><span>JANELA DE 24 HORAS</span></div>
      {failure ? <div className="inline-error">{failure}</div> : null}
      {runs.length ? (
        <div className="run-list">
          {runs.map((run) => (
            <article className="run-item" key={run.id}>
              <div className="run-dot-line"><span className={'run-dot ' + (run.mode.includes('fallback') || run.outcome === 'FAIL' ? 'warn' : 'ok')} /><i /></div>
              <div className="run-details">
                <div className="run-heading"><time>{new Date(run.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time><span>{run.mode}</span></div>
                <h4>{run.query}</h4>
                <p>{run.kind === 'rag' ? <>Busca <b>FTS5 · BM25</b> · {run.retrieved_count} fonte(s) · {run.duration_ms} ms</>
                  : <>Montagem <b>validada no catálogo</b> · {run.retrieved_count} SKU(s) · {run.outcome}</>}</p>
                {run.kind === 'build' ? <p className="run-model-line">Interpretação: {run.interpretation?.called ? run.interpretation.model : 'filtros locais'} · Decisão: {run.decision?.provider || 'ranking local'} · Resposta: {run.generation?.called && !run.generation?.fallback ? run.generation.model : 'prévia local'}</p> : null}
                {run.retrieved_count ? <details className="source-accordion">
                  <summary>{run.kind === 'rag' ? 'Ver fontes e relevância' : 'Ver SKUs oficiais'} <ChevronDown size={13} /></summary>
                  <ul>{run.sources.map((source, index) => <li key={source.url + index}>
                    <a href={source.url} target="_blank" rel="noreferrer"><span>{index + 1}</span>{source.title || 'Fonte catalogada'}<ArrowRight size={11} /></a>
                    <small>{source.category}{run.kind === 'rag' ? ` · BM25 ${source.score}` : ' · catálogo oficial'}</small>
                  </li>)}</ul>
                </details> : null}
                {run.answer ? <details className="source-accordion">
                  <summary>Ver resposta produzida <ChevronDown size={13} /></summary>
                  <p className="run-answer">{run.answer}</p>
                </details> : null}
                {run.input_tokens != null || run.output_tokens != null ? <span className="token-pair">tokens · entrada {run.input_tokens ?? '—'} / saída {run.output_tokens ?? '—'}</span> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-runs"><span><Network size={20} /></span><h3>Nenhuma execução nesta sessão.</h3><p>Converse com o NinjaRUDEUS ou monte um PC para ver as fontes, os SKUs, o modelo usado e a resposta.</p><button onClick={() => window.dispatchEvent(new Event('open-ninja-chat'))}>Abrir o NinjaRUDEUS <ArrowRight size={14} /></button></div>
      )}
      <div className="telemetry-note">
        <div><ShieldCheck size={14} /><span>Isolamento por sessão · 24 horas</span></div>
        <p>A tabela não reúne execuções de outras pessoas. Credenciais do modelo nunca aparecem nos registros.</p>
      </div>
    </div>
  );
}

function ToolbarPanel({ active, close, session, refreshSession }) {
  useEffect(() => {
    const closePanel = () => close();
    window.addEventListener('close-inspector', closePanel);
    return () => window.removeEventListener('close-inspector', closePanel);
  }, [close]);
  if (!active || active === 'menu') return null;
  const current = PANELS.find((item) => item.key === active);
  return (
    <div className={'inspector-overlay' + (active === 'menu' ? ' mobile-tools-open' : '')}>
      <button className="inspector-shade" onClick={close} aria-label="Fechar ferramentas" />
      <aside className="inspector-drawer">
        <div className="drawer-tabs">
          {PANELS.map(({ key, title, Icon }) => <button key={key} onClick={() => {
            if (key === active) close();
            else window.dispatchEvent(new CustomEvent('select-inspector', { detail: key }));
          }} className={active === key ? 'active' : ''} aria-pressed={active === key}><Icon size={14} />{title}</button>)}
        </div>
        {current?.key === 'database' ? <DatabasePanel /> : null}
        {current?.key === 'model' ? <ModelPanel session={session} onConnected={refreshSession} onRefreshRuns={() => window.dispatchEvent(new Event('ninja-runs-changed'))} /> : null}
        {current?.key === 'runs' ? <RunsPanel /> : null}
      </aside>
    </div>
  );
}

function Footer() {
  return (
    <footer className="store-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <BrandMark />
          <p>Hardware bom. Dúvida honesta. Seu setup no próximo nível.</p>
          <span className="footer-demo"><i /> VITRINE DEMONSTRATIVA · PREÇOS CAPTURADOS PARA TESTE</span>
        </div>
        <div className="footer-col"><strong>SEU PRÓXIMO PC</strong><a href="#vitrine">PC gamer</a><a href="#vitrine">PC para montar</a><a href="#vitrine">Placas de vídeo</a><a href="#vitrine">Memória e SSD</a></div>
        <div className="footer-col"><strong>AJUDA DE NINJA</strong><a href="#vitrine">Sobre o catálogo oficial</a><a href="#vitrine">Produtos e hardware</a><a href="#vitrine">Pergunte ao NinjaRUDEUS</a><a href="https://www.setupninja.com.br/" target="_blank" rel="noreferrer">Loja Setup Ninja original</a></div>
        <div className="footer-contact"><span>SEU SUPORTE DE HARDWARE</span><strong>Setup bom é setup escolhido certo.</strong><a href="https://www.setupninja.com.br/" target="_blank" rel="noreferrer">Conheça a loja original <ArrowRight size={14} /></a></div>
      </div>
      <div className="footer-bottom"><span>Setup Ninja · demonstração de vitrine com dados públicos da loja.</span><span>PREÇOS CAPTURADOS EM 02/10/2026 · CONSULTE A LOJA PARA VALORES E DISPONIBILIDADE ATUAIS</span></div>
    </footer>
  );
}

function CartDrawer({ items, onChangeQuantity, onRemove, onClose }) {
  const closeButton = useRef(null);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price_brl * item.quantity, 0);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const focusable = '.cart-drawer button:not(:disabled), .cart-drawer a[href], .cart-drawer input:not(:disabled), .cart-drawer select:not(:disabled), .cart-drawer textarea:not(:disabled), .cart-drawer [tabindex]:not([tabindex="-1"])';
    const trapFocus = (event) => {
      if (event.key !== 'Tab') return;
      const elements = [...document.querySelectorAll(focusable)].filter((element) => element.getClientRects().length);
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, []);
  return (
    <div className="cart-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <header className="cart-drawer-head"><div><span>SACOLA DA VITRINE</span><h2 id="cart-title">Seu carrinho <small>({itemCount})</small></h2></div>
          <button ref={closeButton} aria-label="Fechar carrinho" onClick={onClose}><X size={19} /></button></header>
        {items.length ? <>
          <div className="cart-items">{items.map((item) => <article className="cart-line" key={item.id}>
            {item.image_url ? <img src={item.image_url} alt="" loading="lazy" /> : <span className="cart-line-placeholder"><ShoppingBag size={19} /></span>}
            <div className="cart-line-info"><span>{item.category}</span><strong>{item.name}</strong><small>{compactMoney(item.price_brl)} por unidade</small>
              <div className="cart-quantity" aria-label={`Quantidade de ${item.name}`}>
                <button onClick={() => onChangeQuantity(item.id, item.quantity - 1)} aria-label="Diminuir quantidade"><span aria-hidden="true">−</span></button>
                <b>{item.quantity}</b>
                <button onClick={() => onChangeQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock_quantity} aria-label="Aumentar quantidade"><span aria-hidden="true">+</span></button>
                <button className="cart-remove" onClick={() => onRemove(item.id)}>Remover</button>
              </div>
            </div>
            <b className="cart-line-total">{compactMoney(item.price_brl * item.quantity)}</b>
          </article>)}</div>
          <div className="cart-summary"><div><span>Subtotal do catálogo</span><strong>{compactMoney(totalPrice)}</strong></div>
            <p>Prévia demonstrativa. Preços e estoque são os consultados no catálogo; esta vitrine não processa pedidos nem pagamento.</p>
            <button onClick={onClose}>Continuar explorando <ArrowRight size={15} /></button>
          </div>
        </> : <div className="cart-empty"><ShoppingBag size={30} /><strong>Sua sacola está vazia.</strong><p>Adicione produtos individuais com preço publicado para comparar o total.</p><button onClick={onClose}>Explorar produtos</button></div>}
      </aside>
    </div>
  );
}

const BUILD_CATEGORIES = [
  { key: 'processor', label: 'Processador', slug: 'processadores' },
  { key: 'motherboard', label: 'Placa-mãe', slug: 'placas-mae' },
  { key: 'memory', label: 'Memória', slug: 'memoria-ram' },
  { key: 'graphicsCard', label: 'Placa de vídeo', slug: 'placas-de-video' },
  { key: 'powerSupply', label: 'Fonte', slug: 'fontes' },
  { key: 'case', label: 'Gabinete', slug: 'gabinetes' },
  { key: 'storage', label: 'Armazenamento', slug: 'armazenamento' },
  { key: 'cooler', label: 'Cooler', slug: 'coolers-para-processador' },
];

function PcBuilder({ isActive, onAddProposal }) {
  const [options, setOptions] = useState(null);
  const [partOptions, setPartOptions] = useState({});
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [retryOptions, setRetryOptions] = useState(0);
  const [budget, setBudget] = useState('5000');
  const [memoryGB, setMemoryGB] = useState('32');
  const [request, setRequest] = useState('PC para uso geral');
  const [dedicatedGpu, setDedicatedGpu] = useState(false);
  const [gpuId, setGpuId] = useState('');
  const [cpuVendor, setCpuVendor] = useState('');
  const [result, setResult] = useState(null);
  const [pendingParts, setPendingParts] = useState({});
  const [draftChanged, setDraftChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isActive || options) return undefined;
    let mounted = true;
    setLoadingOptions(true);
    const load = async () => {
      const buildOptions = await api('/api/build/options');
      if (buildOptions.parts) return { buildOptions, parts: buildOptions.parts };
      const catalogs = await Promise.all(BUILD_CATEGORIES.map(({ slug }) => api(`/api/catalog?limit=120&category=${slug}`)));
      return { buildOptions, parts: Object.fromEntries(BUILD_CATEGORIES.map(({ key }, index) => [key, catalogs[index].rows])) };
    };
    load().then(({ buildOptions, parts }) => {
      if (!mounted) return;
      setOptions(buildOptions);
      setPartOptions(Object.fromEntries(BUILD_CATEGORIES.map(({ key }) => [key, (parts[key] || []).map((item) => ({
        ...item, price_brl: Number(item.price_brl ?? Number(item.priceCents) / 100),
        stock_quantity: Number(item.stock_quantity ?? item.stockQuantity), image_url: item.image_url || item.imageUrl || '',
      }))])));
    }).catch((reason) => { if (mounted) setError(reason.message); })
      .finally(() => { if (mounted) setLoadingOptions(false); });
    return () => { mounted = false; };
  }, [isActive, options, retryOptions]);
  async function submit(event, previousBuildId = result?.buildId || '') {
    event?.preventDefault();
    setLoading(true); setError('');
    try {
      const next = await api('/api/build', { method: 'POST', body: JSON.stringify({ budget: Number(budget), memoryGB: Number(memoryGB), request,
        dedicatedGpu, gpuId: gpuId || undefined, cpuVendor: cpuVendor || undefined, previousBuildId: previousBuildId || undefined,
        requiredParts: Object.keys(pendingParts).length ? pendingParts : undefined }) });
      setResult(next);
      setPendingParts({});
      setDraftChanged(false);
    } catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }
  const selected = result?.selected;
  const pickedByCategory = Object.fromEntries(BUILD_CATEGORIES.map(({ key, label }) => [label, key]));
  const completion = selected?.items.length || 0;
  const validatedBudget = Number(result?.telemetry?.budgetCents) / 100 || Number(budget || 0);
  const budgetUsage = validatedBudget > 0 ? Math.min(100, Math.round(selected?.totalPriceCents / 100 / validatedBudget * 100)) : 0;
  const partById = (key, id) => partOptions[key]?.find((item) => String(item.id) === String(id));
  const choicesFor = (key) => {
    const inventory = key === 'processor' ? options?.cpus : key === 'graphicsCard' ? options?.gpus : null;
    return partOptions[key]?.length ? partOptions[key] : inventory?.map((item) => ({ id: item.id, name: item.name, price_brl: item.priceCents / 100 })) || [];
  };
  const selectedCpuId = selected?.items.find((item) => item.category === 'Processador')?.id || '';
  const selectedGpuId = selected?.items.find((item) => item.category === 'Placa de vídeo')?.id || '';
  const mustKeepGpu = Boolean(selectedGpuId)
    || ['gaming', 'workstation'].includes(interpretRequest(request).purpose)
    || /placa\s+de\s+v[ií]deo|gpu|dedicad[ao]|geforce|radeon|\b(?:rtx|gtx|rx)\s*\d/i.test(request);
  const proposalCartItems = (selected?.items || []).map((part) => {
    const key = pickedByCategory[part.category];
    const catalogPart = key && partById(key, part.id);
    const quantity = Math.max(1, Math.trunc(Number(part.quantity) || 1));
    const stock = Math.trunc(Number(part.stockQuantity ?? catalogPart?.stock_quantity));
    const unitCents = Number(part.unitPriceCents);
    const totalCents = Number(part.totalPriceCents);
    if (!catalogPart || !Number.isFinite(stock) || stock < quantity || !Number.isFinite(unitCents) || unitCents < 0
      || !Number.isFinite(totalCents) || totalCents !== unitCents * quantity) return null;
    return { id: String(part.id), name: part.name, category: part.category,
      price_brl: unitCents / 100, image_url: catalogPart.image_url || '', stock_quantity: stock, quantity };
  }).filter(Boolean);
  const canAddProposal = Boolean(selected && !draftChanged && !loading && proposalCartItems.length === selected.items.length);
  return (
    <section className="pc-builder" aria-labelledby="builder-title">
      <div className="builder-intro"><span className="section-overline"><span />MONTAGEM A PARTIR DO CATÁLOGO OFICIAL</span>
        <h1 id="builder-title">Monte seu PC<br /><em>com cada escolha à vista.</em></h1>
        <p>Defina seu objetivo e orçamento. Depois, troque uma peça por vez; cada combinação volta ao validador de estoque e compatibilidade.</p>
      </div>
      <div className="builder-layout">
        <form className="builder-form" onSubmit={submit}>
          <div className="builder-form-title"><span>COMECE PELO OBJETIVO</span><strong>O que você quer montar?</strong></div>
          <label>Uso principal<textarea value={request} onChange={(event) => { setRequest(event.target.value); setDraftChanged(true); }} rows="2" maxLength="900" placeholder="Ex.: PC para jogar em 1440p, editar vídeo ou uso geral" /></label>
          <div className="builder-fields">
            <label>Orçamento máximo<input inputMode="decimal" type="number" min="100" step="100" value={budget} onChange={(event) => { setBudget(event.target.value); setDraftChanged(true); }} required /><small>Valores em reais</small></label>
            <label>Memória desejada<select value={memoryGB} onChange={(event) => { setMemoryGB(event.target.value); setDraftChanged(true); }}><option value="16">16 GB</option><option value="32">32 GB</option><option value="64">64 GB</option></select></label>
          </div>
          <div className="builder-fields">
            <label>Processador<select value={pendingParts.processor ?? selectedCpuId} onChange={(event) => { setPendingParts((current) => ({ ...current, processor: event.target.value })); setDraftChanged(true); }} disabled={!options}><option value="">Sugestão automática</option>{choicesFor('processor').map((cpu) => <option key={cpu.id} value={cpu.id}>{cpu.name} · {compactMoney(cpu.price_brl)}</option>)}</select></label>
            <label>Marca do processador<select value={cpuVendor} onChange={(event) => { setCpuVendor(event.target.value); setDraftChanged(true); }}><option value="">Sem preferência</option><option value="amd">AMD</option><option value="intel">Intel</option></select></label>
          </div>
          <label>Placa de vídeo<select value={pendingParts.graphicsCard ?? (selectedGpuId || gpuId)} onChange={(event) => { setPendingParts((current) => ({ ...current, graphicsCard: event.target.value })); setGpuId(event.target.value); if (event.target.value) setDedicatedGpu(true); setDraftChanged(true); }} disabled={!options}><option value="">{dedicatedGpu ? 'Qualquer opção validada' : 'Sem placa dedicada'}</option>{choicesFor('graphicsCard').map((gpu) => <option key={gpu.id} value={gpu.id}>{gpu.name} · {compactMoney(gpu.price_brl)}</option>)}</select></label>
          <label className="builder-check"><input type="checkbox" checked={dedicatedGpu || mustKeepGpu} disabled={mustKeepGpu} onChange={(event) => { setDedicatedGpu(event.target.checked); setDraftChanged(true); if (!event.target.checked) { setGpuId(''); setPendingParts((current) => { const next = { ...current }; delete next.graphicsCard; return next; }); } }} /> Incluir placa de vídeo dedicada</label>
          {mustKeepGpu ? <small className="builder-gpu-note">Este pedido ou a proposta atual pede uma placa dedicada. Para começar uma montagem sem GPU dedicada, use “Nova montagem”.</small> : null}
          <button className="builder-submit" disabled={loading || loadingOptions || !options}>{loading ? 'VALIDANDO PEÇAS…' : loadingOptions ? 'CARREGANDO CATÁLOGO…' : result ? 'ATUALIZAR SUGESTÃO' : 'MONTAR MINHA SUGESTÃO'} <ArrowRight size={16} /></button>
          {error ? <p className="builder-error" role="alert">{error}</p> : null}
          {!options && !loadingOptions && error ? <button className="builder-options-retry" type="button" onClick={() => { setError(''); setRetryOptions((attempt) => attempt + 1); }}>Tentar carregar as peças novamente</button> : null}
          <small>{loadingOptions ? 'Buscando opções disponíveis no catálogo oficial…' : 'Usamos SKUs disponíveis da loja. Preços e estoque podem mudar; o resultado não inicia uma compra.'}</small>
        </form>
        <div className="builder-result" aria-live="polite">
          {selected ? <>
            {draftChanged ? <div className="builder-pending-note" role="status">Há mudanças no pedido. Abaixo está a última proposta validada; atualize para conferir os novos SKUs e o orçamento.</div> : null}
            <button type="button" className="builder-reset" onClick={() => { setResult(null); setRequest('PC para uso geral'); setDedicatedGpu(false); setGpuId(''); setPendingParts({}); setDraftChanged(false); setError(''); }}>Nova montagem</button>
            <div className="builder-result-head"><div className="builder-result-label"><span className="builder-status-dot" /><span>PROPOSTA VALIDADA NO CATÁLOGO</span></div>
              <strong>{money.format(selected.totalPriceCents / 100)}</strong><small>de até {money.format(validatedBudget)} · {Math.max(0, validatedBudget - selected.totalPriceCents / 100) > 0 ? `${money.format(validatedBudget - selected.totalPriceCents / 100)} livres` : 'orçamento utilizado'}</small>
              <span className={'compat-badge status-' + selected.compatibility.status.toLowerCase()}><ShieldCheck size={14} /> Compatibilidade {selected.compatibility.status}</span></div>
            <div className="builder-progress" aria-label={`${budgetUsage}% do orçamento usado`}><span><b>{completion}</b> SKUs na proposta <small>{budgetUsage}% do orçamento usado</small></span><div><i style={{ width: `${budgetUsage}%` }} /></div></div>
            <p className="builder-copy">{selected.explanation}</p>
            <div className="builder-parts">{selected.items.map((part) => <article key={part.id}>
              {partById(pickedByCategory[part.category], part.id)?.image_url ? <img className="builder-part-image" src={partById(pickedByCategory[part.category], part.id).image_url} alt="" loading="lazy" /> : <span className="builder-part-placeholder"><Cpu size={17} /></span>}
              <div><span>{part.category}{part.quantity > 1 ? ` · ${part.quantity} unidades` : ''}</span><strong>{part.name}</strong>
                <small>SKU {part.id} · {part.stockQuantity} em estoque no momento da consulta</small></div>
              <b>{money.format(part.totalPriceCents / 100)}</b>
              {pickedByCategory[part.category] && choicesFor(pickedByCategory[part.category]).length ? <label className="builder-swap">Trocar<select aria-label={`Trocar ${part.category}`} value={pendingParts[pickedByCategory[part.category]] || part.id} onChange={(event) => { setPendingParts((current) => ({ ...current, [pickedByCategory[part.category]]: event.target.value })); setDraftChanged(true); }}><option value={part.id}>Manter selecionado</option>{choicesFor(pickedByCategory[part.category]).filter((item) => String(item.id) !== String(part.id)).map((item) => <option key={item.id} value={item.id}>{item.name} · {compactMoney(item.price_brl)}</option>)}</select></label> : null}
            </article>)}</div>
            {selected.unknownRules.length ? <div className="builder-unknown"><strong>Itens que precisam de conferência</strong><p>{selected.unknownRules.join(' · ')}. Compatibilidade sem dados suficientes continua desconhecida; consulte as especificações antes de comprar.</p></div> : null}
            {result.refinement?.changedParts?.length ? <p className="builder-change-note">Após validar as trocas, o montador ajustou {result.refinement.changedParts.join(', ')} para manter a proposta viável. Confira os SKUs acima.</p> : null}
            <div className="builder-audit"><span>Seleção: {result.decision.provider === 'deterministic' ? 'regras do montador' : result.decision.provider} · {result.decision.model}</span><span>Fonte e estoque: catálogo oficial Monte seu PC · consultado agora</span></div>
            {result.candidates.length > 1 ? <details className="builder-alternatives"><summary>{result.candidates.length - 1} outras opções viáveis</summary>{result.candidates.slice(1).map((candidate) => <div key={candidate.id}><span>{candidate.items[0]?.name} · {candidate.items.find((item) => item.category === 'Placa de vídeo')?.name || 'vídeo integrado'}</span><b>{money.format(candidate.totalPriceCents / 100)}</b></div>)}</details> : null}
            <button type="button" className="builder-add-cart" onClick={() => onAddProposal(proposalCartItems)} disabled={!canAddProposal}><ShoppingBag size={16} />Adicionar SKUs à sacola demonstrativa</button>
            {draftChanged ? <small className="builder-cart-hint">Valide as alterações antes de adicionar esta proposta à sacola.</small> : null}
            <button className="builder-refine" onClick={(event) => submit(event, result.buildId)} disabled={loading || !Object.keys(pendingParts).length}>{loading ? 'VALIDANDO COMBINAÇÃO…' : Object.keys(pendingParts).length ? 'Validar trocas e atualizar' : 'Selecione uma peça acima para trocar'} <ArrowRight size={14} /></button>
          </> : <div className="builder-empty"><Cpu size={38} /><strong>Uma lista de peças, com as contas na mesa.</strong><p>O resultado inclui evidências, estoque por SKU e limites que o catálogo não permite confirmar.</p></div>}
        </div>
      </div>
    </section>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [panel, setPanel] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [category, setCategory] = useState('todos');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('setupninja-demo-cart') || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string'
        && Number.isFinite(item.price_brl) && item.price_brl >= 0 && Number.isFinite(item.stock_quantity) && item.stock_quantity > 0)
        .slice(0, 80).map((item) => ({ ...item,
          stock_quantity: Math.max(1, Math.trunc(item.stock_quantity)),
          quantity: Math.min(Math.max(1, Math.trunc(Number(item.quantity) || 1)), Math.max(1, Math.trunc(item.stock_quantity))) }));
    } catch { return []; }
  });
  const [view, setView] = useState('store');
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    try { window.localStorage.setItem('setupninja-demo-cart', JSON.stringify(cart)); } catch { /* storage can be disabled */ }
  }, [cart]);

  async function refreshSession() {
    try { setSession(await api('/api/session')); }
    catch (error) { setLoadError('Não foi possível iniciar o catálogo. ' + error.message); }
  }
  useEffect(() => {
    refreshSession();
    const onSelect = (event) => setPanel(event.detail);
    const onBuilder = () => {
      setPanel('');
      setView('builder');
      window.setTimeout(() => document.querySelector('.store-view-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    };
    window.addEventListener('select-inspector', onSelect);
    window.addEventListener('open-pc-builder', onBuilder);
    return () => {
      window.removeEventListener('select-inspector', onSelect);
      window.removeEventListener('open-pc-builder', onBuilder);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api('/api/catalog?limit=48&category=' + encodeURIComponent(category)
      + '&q=' + encodeURIComponent(query) + '&sort=' + encodeURIComponent(sort))
      .then((response) => {
        if (!active) return;
        setProducts(response.rows);
        setStats(response);
        setTotal(response.total);
        setLoadError('');
      })
      .catch((error) => active && setLoadError(error.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [category, query, sort]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') { setPanel(''); setChatOpen(false); setCartOpen(false); }
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        document.querySelector('.store-search input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  function chooseCategory(value) {
    const match = CATEGORIES.find((item) => item.label.toLowerCase() === value.toLowerCase() || item.slug === value);
    setCategory(match?.slug || value);
    setQuery('');
    setPanel('');
    document.getElementById('vitrine')?.scrollIntoView({ behavior: 'smooth' });
  }
  function addToCart(product) {
    if (!Number.isFinite(product.price_brl) || !Number.isFinite(product.stock_quantity) || product.stock_quantity <= 0) {
      setNotice(Number.isFinite(product.price_brl) ? 'Esse item não tem estoque disponível no catálogo.' : 'Esse item não tem preço individual publicado.');
      return;
    }
    const stock = Math.trunc(Number(product.stock_quantity));
    setCart((items) => {
      const existing = items.find((item) => item.id === String(product.id));
      if (existing) return items.map((item) => item.id === existing.id ? { ...item, quantity: Math.min(item.quantity + 1, stock) } : item);
      return [...items, { id: String(product.id), name: product.name, category: product.category, price_brl: product.price_brl,
        image_url: product.image_url || '', stock_quantity: stock, quantity: 1 }];
    });
    setCartOpen(true);
    setNotice(product.name.slice(0, 52) + ' adicionado à sua sacola.');
  }
  function addProposalToCart(proposal) {
    if (!proposal.length) return;
    setCart((items) => {
      const next = [...items];
      proposal.forEach((product) => {
        const id = String(product.id);
        const stock = Math.max(1, Math.trunc(Number(product.stock_quantity) || 1));
        const quantity = Math.min(stock, Math.max(1, Math.trunc(Number(product.quantity) || 1)));
        const index = next.findIndex((item) => item.id === id);
        const existing = next[index];
        if (existing) {
          next[index] = { ...existing, quantity: Math.min(stock, existing.quantity + quantity), stock_quantity: stock };
        } else {
          next.push({ id, name: product.name, category: product.category, price_brl: product.price_brl,
            image_url: product.image_url || '', stock_quantity: stock, quantity });
        }
      });
      return next;
    });
    setCartOpen(true);
    setNotice(`${proposal.length} SKUs da proposta adicionados à sacola demonstrativa.`);
  }
  function changeCartQuantity(id, quantity) {
    const wholeQuantity = Math.trunc(Number(quantity));
    setCart((items) => items.flatMap((item) => item.id !== id ? [item]
      : wholeQuantity <= 0 ? [] : [{ ...item, quantity: Math.min(wholeQuantity, item.stock_quantity) }]));
  }
  function removeCartItem(id) { setCart((items) => items.filter((item) => item.id !== id)); }
  function selectedLabel() { return CATEGORIES.find((item) => item.slug === category)?.label || category; }

  return (
    <div className="application-shell">
      <OperatorBar active={panel} onChange={setPanel} session={session} />
      <Header onSearch={setQuery} onCart={() => setCartOpen(true)} cartCount={cartCount} />
      <main>
        <div className="store-main">
          <div className="store-view-tabs" role="tablist" aria-label="Área da demonstração">
            <button role="tab" aria-selected={view === 'store'} className={view === 'store' ? 'active' : ''} onClick={() => setView('store')}>Loja e catálogo</button>
            <button role="tab" aria-selected={view === 'builder'} className={view === 'builder' ? 'active' : ''} onClick={() => setView('builder')}>Monte seu PC <Cpu size={15} /></button>
          </div>
          {view === 'builder' ? null : <>
          <nav className="breadcrumb" aria-label="Navegação estrutural">
            <a href="#inicio">Início</a><ChevronRight size={12} /><span>O marketplace do seu próximo setup</span>
            {query ? <><ChevronRight size={12} /><strong>{query}</strong><button onClick={() => setQuery('')} aria-label="Limpar busca"><X size={12} /></button></> : null}
          </nav>
          <Hero onChooseCategory={chooseCategory} />
          <BenefitBar />
          <div className="seller-credit"><span><Check size={13} /></span> Catálogo demonstrativo baseado na vitrine pública da <a href="https://www.setupninja.com.br/" target="_blank" rel="noreferrer">Setup Ninja original</a>.<span>Valores não são ofertas ao consumidor.</span></div>
          <CategoryRail selected={category} onSelect={setCategory} />
          <section className="showcase" id="vitrine">
            <div className="showcase-title">
              <div>
                <span className="section-overline"><span />O PRÓXIMO UP DO SEU SETUP</span>
                <h2>Peças de respeito.<br /><em>Preço de ninja.</em></h2>
              </div>
              <p>Produtos realmente encontrados na loja. Filtre sua missão e encontre o upgrade que sua máquina está pedindo.</p>
            </div>
            <div className="collection-bar">
              <div className="active-collection"><span className="collection-icon"><ShoppingBag size={17} /></span>
                <span><strong>{selectedLabel()}</strong><small>{total} produtos na seleção de demonstração</small></span>
              </div>
              <div className="collection-controls">
                <label className="sort-control"><SlidersHorizontal size={15} /><span>Ordenar:</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar produtos">
                    <option value="featured">Destaques</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option>
                  </select><ChevronDown size={13} /></label>
                <span className="collection-pagination">{products.length ? '1—' + products.length : '0'} de {total}</span>
              </div>
            </div>
            <div className="product-grid" aria-live="polite">
              {loading ? Array.from({ length: 8 }, (_, index) => <div key={index} className="product-skeleton" aria-hidden="true"><span /><i /><i /><b /></div>) : null}
              {!loading && !loadError ? products.map((product, index) => <ProductCard key={product.id} product={product} index={index} onAdd={addToCart} />) : null}
            </div>
            {loadError ? <div role="alert" className="catalog-error"><CircleHelp size={20} /><span>{loadError}</span><button onClick={() => refreshSession()}>Tentar novamente</button></div> : null}
            {!loading && !loadError && !products.length ? <div className="no-products"><Search size={20} /><strong>Nenhum produto encontrado.</strong><button onClick={() => { setQuery(''); setCategory('todos'); }}>Limpar filtros</button></div> : null}
            <div className="store-legal-note"><ShieldCheck size={14} /><span>Preços coletados em {session?.database?.collectionDate?.split('-').reverse().join('/')} para esta demonstração. Os produtos podem mudar de valor ou de disponibilidade a qualquer momento. Nenhuma compra é processada nesta vitrine.</span></div>
            {stats?.categories?.length ? (
              <div className="browse-everything"><span>Ainda explorando?</span>{stats.categories.map((item) => (
                <button key={item.slug} onClick={() => setCategory(item.slug)}>{item.name}<span>{item.count}</span></button>
              ))}</div>
            ) : null}
            <section className="ninja-callout">
              <div className="ninja-callout-brand"><BrandMark /><span><i /> NINJA ONLINE PARA SUA DÚVIDA</span></div>
              <div className="callout-heading"><h3>Seu setup merece<br /><em>uma resposta de respeito.</em></h3><p>Compatibilidade, componentes e aquele jogo que não para de travar. O NinjaRUDEUS indica, fundamenta e nunca inventa.</p></div>
              <button onClick={() => setChatOpen(true)}>Perguntar agora <ArrowRight size={15} /></button>
              <span className="callout-orbit" aria-hidden="true" /><Sparkles className="callout-sparkle" size={49} />
            </section>
          </section>
          </>}
          <div hidden={view !== 'builder'}><PcBuilder isActive={view === 'builder'} onAddProposal={addProposalToCart} /></div>
        </div>
      </main>
      <Footer />
      <OperatorBarSpacer />
      <ToolbarPanel active={panel} close={() => setPanel('')} session={session} refreshSession={refreshSession} />
      <ChatWidget open={chatOpen} setOpen={setChatOpen} setPanel={setPanel} panel={panel} />
      {cartOpen ? <CartDrawer items={cart} onChangeQuantity={changeCartQuantity} onRemove={removeCartItem} onClose={() => setCartOpen(false)} /> : null}
      {notice ? <div className="shop-toast" role="status"><Check size={15} />{notice}<button onClick={() => setNotice('')} aria-label="Dispensar"><X size={13} /></button></div> : null}
    </div>
  );
}
function OperatorBarSpacer() { return <a className="back-to-top" href="#inicio" aria-label="Voltar ao topo"><ChevronLeft size={15} /><span>TOPO</span></a>; }

createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
);
