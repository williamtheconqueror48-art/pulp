"use client";

import Script from "next/script";

export default function Page() {
  return (
    <>
      {/* ============ LANDING: THE DEEP ============ */}
      <section id="landing" aria-label="Welcome to Pulp">
        <canvas id="deep" aria-hidden="true"></canvas>
        <div className="landing-ui">
          <div className="wordmark" id="wordmark">PULP</div>
          <h1 className="tagline">Ideas swim in the deep.<br /><span>Go down and catch one.</span></h1>
          <p className="sub">A free studio for screenplays, poems &amp; songs.<br />Unlimited scripts. Industry formatting. Zero cost, forever.</p>
          <blockquote className="pullquote">
            “If you want to catch little fish, you can stay in the shallow water. But if you want to catch the big fish, you’ve got to go deeper.”
            <cite>— David Lynch, <i>Catching the Big Fish</i></cite>
          </blockquote>
          <button id="dive" className="dive-btn" type="button">
            <span className="dive-label">click to dive in</span>
            <span className="dive-arrow">v</span>
          </button>
          <div className="landing-foot">no accounts &nbsp;·&nbsp; no paywalls &nbsp;·&nbsp; your words stay yours</div>
        </div>
      </section>

      {/* ============ STUDIO ============ */}
      <section id="studio" hidden aria-label="Pulp writing studio">
        <aside id="library" aria-label="Script library">
          <div className="lib-head">
            <div className="lib-mark">PULP</div>
            <button id="newDocBtn" className="icon-btn" title="New document (Ctrl+N)">+</button>
          </div>
          <div id="newMenu" className="new-menu" hidden>
            <button data-newtype="screenplay"><b>S</b><span>Screenplay<small>film &amp; TV scripts</small></span></button>
            <button data-newtype="poem"><b>P</b><span>Poem<small>verse, free form</small></span></button>
            <button data-newtype="song"><b>♪</b><span>Song<small>lyrics &amp; sections</small></span></button>
          </div>
          <div id="docList" className="doc-list"></div>
          <div className="lib-foot">
            <button id="whyBtn" className="ghost-btn" title="Why Pulp — our manifesto">Why Pulp</button>
            <button id="shortcutsBtn" className="ghost-btn" title="Keyboard shortcuts">?</button>
            <button id="deskToggle" className="ghost-btn" title="Toggle desk light">◐</button>
          </div>
        </aside>

        <main id="deskWrap">
          <header id="topbar">
            <input id="docTitle" className="doc-title" defaultValue="Untitled" spellCheck={false} aria-label="Document title" />
            <span id="docType" className="type-badge">screenplay</span>
            <span id="saveState" className="save-state">saved</span>
            <div className="top-actions">
              <button id="titlePageBtn" className="tbtn" title="Title page">Title</button>
              <button id="navToggle" className="tbtn" title="Scene navigator">Scenes</button>
              <button id="typewriterBtn" className="tbtn" title="Typewriter mode">Typewriter</button>
              <button id="focusBtn" className="tbtn" title="Focus mode">Focus</button>
              <div className="export-wrap">
                <button id="exportBtn" className="tbtn accent" title="Export">Export ▾</button>
                <div id="exportMenu" className="menu" hidden>
                  <button data-exp="fountain">.fountain <small>screenplay format</small></button>
                  <button data-exp="pdf">PDF <small>via print</small></button>
                  <button data-exp="txt">Plain text</button>
                </div>
              </div>
            </div>
          </header>

          <div id="statsbar" aria-label="Document statistics">
            <span id="statPages">0 pages</span><i>·</i>
            <span id="statWords">0 words</span><i>·</i>
            <span id="statMins">~0 min</span>
            <span id="elHint" className="el-hint">Tab to change element · Enter for next</span>
          </div>

          <div id="desk" className="desk-dark">
            <div id="paperScroll">
              <div id="paper">
                <div id="titlePageView" className="title-page" hidden></div>
                <div id="editor" aria-label="Writing canvas"></div>
                <div id="paperEnd" className="paper-end">— · —</div>
              </div>
            </div>
            <aside id="navigator" hidden aria-label="Scene navigator">
              <div className="nav-head">SCENES</div>
              <div id="navList"></div>
            </aside>
          </div>
        </main>
      </section>

      {/* Title page modal */}
      <div id="tpModal" className="modal" hidden>
        <div className="modal-card">
          <h2>Title page</h2>
          <label>Title<input id="tpTitle" spellCheck={false} /></label>
          <label>Credit<input id="tpCredit" placeholder="written by" spellCheck={false} /></label>
          <label>Author<input id="tpAuthor" spellCheck={false} /></label>
          <label>Draft<input id="tpDraft" placeholder="First Draft — Oct 2026" spellCheck={false} /></label>
          <label>Contact<textarea id="tpContact" rows={3} spellCheck={false}></textarea></label>
          <label className="row"><input type="checkbox" id="tpShow" defaultChecked /> Show title page on paper &amp; in exports</label>
          <div className="modal-actions">
            <button id="tpSave" className="tbtn accent">Done</button>
          </div>
        </div>
      </div>

      {/* Why Pulp manifesto modal */}
      <div id="whyModal" className="modal" hidden>
        <div className="modal-card wide">
          <h2>Why Pulp</h2>
          <div className="manifesto">
            <p>Screenwriting software costs hundreds of dollars and rents your own words back to you by subscription. That is backwards. The tools a writer needs — proper screenplay formatting, title pages, outlines, exports — are not luxuries. They are the desk itself.</p>
            <p><b>Pulp is that desk, free forever.</b> Write as many screenplays, poems and songs as you want. No accounts, no paywalls, no tiers, no "pro" locked behind a card. Your work lives in your browser and syncs to your own shelf — and it is yours, full stop. We will never hold a draft hostage, never watermark your PDF, never count your pages.</p>
            <p>Ideas swim in the deep. The water should be open to everyone.</p>
            <p className="sig">— PULP</p>
          </div>
          <div className="modal-actions"><button id="whyClose" className="tbtn accent">Dive back in</button></div>
        </div>
      </div>

      {/* Shortcuts modal */}
      <div id="scModal" className="modal" hidden>
        <div className="modal-card">
          <h2>Shortcuts</h2>
          <table className="sc-table">
            <tbody>
              <tr><td><kbd>Tab</kbd> / <kbd>Shift+Tab</kbd></td><td>cycle screenplay element</td></tr>
              <tr><td><kbd>Enter</kbd></td><td>new block, smart next element</td></tr>
              <tr><td><kbd>Ctrl/⌘ N</kbd></td><td>new document</td></tr>
              <tr><td><kbd>Ctrl/⌘ E</kbd></td><td>export menu</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>close panels</td></tr>
            </tbody>
          </table>
          <div className="modal-actions"><button id="scClose" className="tbtn accent">Close</button></div>
        </div>
      </div>

      <div id="charSuggest" className="suggest" hidden></div>
      <div id="toast" className="toast" hidden></div>

      <Script src="/js/fish.js" strategy="afterInteractive" />
      <Script src="/js/studio.js" strategy="afterInteractive" />
    </>
  );
}
