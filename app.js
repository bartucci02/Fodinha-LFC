const supabaseUrl = 'https://tcaawvgryjacfkzyplce.supabase.co';
const supabaseKey = 'sb_publishable_woiFZ6BailldN-0rdtZD_w_r1mvZQcD';
const dbClient = supabase.createClient(supabaseUrl, supabaseKey);

let dbJogadores = [];
let dbTorneios = [];
let dbRivalidades = [];
let atualCampeaoName = "";
let usuarioLogado = null;

// ── AUTENTICAÇÃO ──────────────────────────────────────────────

dbClient.auth.onAuthStateChange((_evento, sessao) => {
    usuarioLogado = sessao?.user ?? null;
    atualizarUI();
});

async function iniciarAuth() {
    const { data } = await dbClient.auth.getSession();
    usuarioLogado = data.session?.user ?? null;
    atualizarUI();
}

function atualizarUI() {
    const btn = document.getElementById('authBtn');
    const bloqueado = document.getElementById('registroBloqueado');

    if (usuarioLogado) {
        document.body.classList.add('autenticado');
        btn.textContent = '🔓 Sair';
        btn.classList.add('logged');
        if (bloqueado) bloqueado.style.display = 'none';
    } else {
        document.body.classList.remove('autenticado');
        btn.textContent = '🔒 Admin';
        btn.classList.remove('logged');
        if (bloqueado) bloqueado.style.display = 'block';
    }
}

function clicouAuth() {
    if (usuarioLogado) {
        if (confirm('Deseja sair da conta admin?')) fazerLogout();
    } else {
        abrirModal();
    }
}

function abrirModal() {
    document.getElementById('modalLogin').classList.add('show');
    setTimeout(() => document.getElementById('loginEmail').focus(), 100);
}

function fecharModal() {
    document.getElementById('modalLogin').classList.remove('show');
    document.getElementById('loginErro').classList.remove('show');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginSenha').value = '';
}

async function fazerLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const btn = document.getElementById('btnLogin');
    const erro = document.getElementById('loginErro');

    if (!email || !senha) {
        erro.textContent = 'Preencha email e senha.';
        erro.classList.add('show');
        return;
    }

    btn.textContent = 'Entrando...';
    btn.disabled = true;
    erro.classList.remove('show');

    const { error } = await dbClient.auth.signInWithPassword({ email, password: senha });

    btn.textContent = 'Entrar';
    btn.disabled = false;

    if (error) {
        erro.textContent = 'Email ou senha incorretos.';
        erro.classList.add('show');
    } else {
        fecharModal();
    }
}

async function fazerLogout() {
    await dbClient.auth.signOut();
}

// Fecha modal ao clicar fora dele
document.getElementById('modalLogin').addEventListener('click', function(e) {
    if (e.target === this) fecharModal();
});

// ── JOGO LOCAL ────────────────────────────────────────────────

let players = JSON.parse(localStorage.getItem('lfc_players') || '[]');
function save(){ localStorage.setItem('lfc_players', JSON.stringify(players)); }

function addPlayer(){
  const n = document.getElementById('pname').value.trim();
  const l = parseInt(document.getElementById('plives').value) || 5;
  if(!n) return;
  players.push({name:n, lives:l, max:l});
  document.getElementById('pname').value = '';
  document.getElementById('pname').focus();
  save(); render();
}

function chgLives(i, d){
  players[i].lives = Math.max(0, players[i].lives + d);
  save(); render();
}

function rmPlayer(i){ players.splice(i,1); save(); render(); }

function resetGame(){
  if(players.length && !confirm('Iniciar novo jogo?')) return;
  players=[]; save(); render();
}

function setAll(){
  const v = prompt('Quantas vidas para todos?','5');
  if(!v) return;
  const n = parseInt(v);
  if(isNaN(n)||n<1) return;
  players.forEach(p=>{ p.lives=n; p.max=n; });
  save(); render();
}

function render(){
  const list = document.getElementById('playerList');
  const banner = document.getElementById('winBanner');
  if(!players.length){
    list.innerHTML='<div class="empty"><div class="ei">🃏</div><p>Adicione jogadores para começar!</p></div>';
    banner.classList.remove('show'); return;
  }
  const alive = players.filter(p=>p.lives>0);
  const winner = alive.length===1 && players.length>1 ? alive[0] : null;
  banner.classList.toggle('show',!!winner);

  if(winner) {
    document.getElementById('winName').textContent = winner.name.toUpperCase();
    atualCampeaoName = winner.name;
    popularSelectVice();
  }

  const sorted = players.map((p,i)=>({...p,i})).sort((a,b)=>{
    if(a.lives===0&&b.lives>0) return 1;
    if(b.lives===0&&a.lives>0) return -1;
    return b.lives - a.lives;
  });

  const medals=['🥇','🥈','🥉'];
  list.innerHTML = sorted.map((p, di)=>{
    const dead=p.lives===0;
    const champ=winner&&p.name===winner.name;
    const icon = champ?'🏆':dead?'💀':(di<3?medals[di]:'');
    const hearts = Array.from({length:p.max},(_,k)=>`<span class="heart">${k<p.lives?'❤️':'🖤'}</span>`).join('');
    return `<div class="pcard ${dead?'dead':''} ${champ?'champ':''}">
      <span class="prank">${icon}</span>
      <div class="pinfo">
        <div class="pname">${esc(p.name)}</div>
        <div class="hearts">${hearts}</div>
      </div>
      <div class="plives">
        <button class="lbtn m" onclick="chgLives(${p.i},-1)" ${dead?'disabled':''}>−</button>
        <span class="lnum ${dead?'zero':''}">${p.lives}</span>
        <button class="lbtn p" onclick="chgLives(${p.i},+1)">+</button>
      </div>
      <button class="pdel" onclick="rmPlayer(${p.i})" title="Remover">✕</button>
    </div>`;
  }).join('');
}

function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── SUPABASE: LEITURA ─────────────────────────────────────────

async function fetchDatabase() {
    const resHegemonias = await dbClient.from('hegemonias').select('*');
    if (resHegemonias.data) {
        const hList = document.getElementById('hegemoniasList');
        if(hList) {
            hList.innerHTML = resHegemonias.data.map(h => `
                <div class="tag-item">
                    <span class="tag-val">${h.campeao}</span>
                    <span class="tag-label" style="font-weight:bold">${h.torneio}</span>
                    <span class="tag-label" style="color:var(--muted); font-size:0.7rem">${h.quantidade_titulos} seguidos (${h.edicoes})</span>
                </div>
            `).join('');
        }
    }

    const resCampeoes = await dbClient.from('maiores_campeoes').select('*');
    if (resCampeoes.data) {
        const cList = document.getElementById('campeoesList');
        if(cList) {
            cList.innerHTML = resCampeoes.data.map(c => `
                <div class="tag-item">
                    <span class="tag-val">${c.campeao}</span>
                    <span class="tag-label" style="font-weight:bold">${c.torneio}</span>
                    <span class="tag-label" style="color:var(--muted); font-size:0.7rem">${c.quantidade_titulos} Títulos</span>
                </div>
            `).join('');
        }
    }

    const resRivalidades = await dbClient.from('rivalidades').select('*, j1:jogador_1_id(nome), j2:jogador_2_id(nome)');
    if (resRivalidades.data) { dbRivalidades = resRivalidades.data; renderRivalidades(); }

    const resJogadores = await dbClient.from('jogadores').select('*');
    if (!resJogadores.error) {
        dbJogadores = resJogadores.data;
        popularSelectRemover();
    }

    const resTorneios = await dbClient.from('torneios').select('*');
    if (!resTorneios.error) {
        dbTorneios = resTorneios.data;
        const selectT = document.getElementById('selectTorneio');
        if(selectT && dbTorneios.length > 0) {
            selectT.innerHTML = '<option value="">Selecione o Torneio...</option>' +
            dbTorneios.map(t => `<option value="${t.id}">${t.nome} (Ed. ${(t.edicao_atual || 0) + 1})</option>`).join('');
        }
    }

    renderStatsGraficos();
    renderTitulosDetalhados();
}

function popularSelectRemover() {
    const sel = document.getElementById('selectRemoverJogador');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione um jogador...</option>' +
        [...dbJogadores].sort((a,b) => a.nome.localeCompare(b.nome))
            .map(j => `<option value="${j.id}">${j.nome}</option>`).join('');
}

// ── SUPABASE: ESCRITA (via API backend) ───────────────────────

async function apiCall(url, method, body) {
    const { data: { session } } = await dbClient.auth.getSession();
    if (!session) { abrirModal(); return null; }
    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body)
    });
    return res.json();
}

async function adicionarJogadorNoBanco() {
    if (!usuarioLogado) { abrirModal(); return; }

    const input = document.getElementById('novoJogadorNome');
    const nome = input.value.trim();
    if (!nome) { alert('Digite o nome do jogador!'); return; }

    const data = await apiCall('/api/jogador-add', 'POST', { nome });
    if (!data) return;
    if (data.error) { alert('❌ ' + data.error); return; }

    alert(`✅ "${nome}" adicionado ao banco de dados.`);
    input.value = '';
    await fetchDatabase();
}

async function removerJogadorDoBanco() {
    if (!usuarioLogado) { abrirModal(); return; }

    const sel = document.getElementById('selectRemoverJogador');
    const jogadorId = parseInt(sel.value);
    if (!jogadorId) { alert('Selecione um jogador para remover!'); return; }

    const jogador = dbJogadores.find(j => j.id === jogadorId);
    if (!jogador) return;

    if (!confirm(`Tem certeza que deseja remover "${jogador.nome}" do banco?\n\nEsta ação não pode ser desfeita.`)) return;

    const data = await apiCall('/api/jogador-remove', 'DELETE', { jogadorId });
    if (!data) return;
    if (data.error) { alert('❌ Erro ao remover: ' + data.error); return; }

    alert(`✅ "${jogador.nome}" foi removido do banco de dados.`);
    await fetchDatabase();
}

function popularSelectVice() {
    const selectV = document.getElementById('selectVice');
    if(!selectV) return;
    const vices = players.filter(p => p.name !== atualCampeaoName);
    selectV.innerHTML = '<option value="">Selecione o Vice-Campeão...</option>' +
        vices.map(v => `<option value="${v.name}">${v.name}</option>`).join('');
}

async function registrarNoBanco() {
    if (!usuarioLogado) { abrirModal(); return; }

    const torneioId = parseInt(document.getElementById('selectTorneio').value);
    const viceNome  = document.getElementById('selectVice').value;
    const btnSalvar = document.querySelector('.registro-banco .btn-r');

    if (!torneioId || !viceNome) {
        alert('Selecione o torneio e o vice-campeão antes de salvar!');
        return;
    }

    const campeao = dbJogadores.find(j => j.nome.toLowerCase() === atualCampeaoName.toLowerCase());
    const vice    = dbJogadores.find(j => j.nome.toLowerCase() === viceNome.toLowerCase());

    if (!campeao) { alert(`Jogador "${atualCampeaoName}" não encontrado no banco!`); return; }

    if (btnSalvar) { btnSalvar.textContent = '⏳ Salvando...'; btnSalvar.disabled = true; }

    try {
        const data = await apiCall('/api/registrar', 'POST', {
            torneioId,
            campeaoId: campeao.id,
            viceId: vice?.id ?? null
        });
        if (!data) return;
        if (data.error) throw new Error(data.error);

        alert(`✅ ${data.message}`);
        await fetchDatabase();

    } catch(e) {
        alert('❌ Erro ao salvar: ' + e.message);
    } finally {
        if (btnSalvar) { btnSalvar.textContent = '💾 Salvar no Banco de Dados'; btnSalvar.disabled = false; }
    }
}

// ── RENDER: STATS ─────────────────────────────────────────────

function renderRivalidades() {
    const rList = document.getElementById('rivalidadesList');
    if(!rList) return;
    const rivaisOrdenados = [...dbRivalidades].sort((a,b) => (b.vitorias_1 + b.vitorias_2) - (a.vitorias_1 + a.vitorias_2));
    rList.innerHTML = rivaisOrdenados.map(r => {
        const total = r.vitorias_1 + r.vitorias_2;
        return `
        <div style="background:var(--bg); border-radius:8px; padding:12px; margin-bottom:10px; border-left:4px solid var(--red);">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.7rem; color:var(--gold); text-transform:uppercase; font-weight:bold;">
                <span>${r.nome_classico}</span>
                <span>${total} Finais</span>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:1.1rem; font-weight:bold;">
                <span>${r.j1?.nome || '?'} <small style="color:var(--muted)">${r.vitorias_1}</small></span>
                <span style="background:var(--s3); padding:4px 10px; border-radius:20px; font-size:0.9rem; color:var(--red);">VS</span>
                <span><small style="color:var(--muted)">${r.vitorias_2}</small> ${r.j2?.nome || '?'}</span>
            </div>
        </div>`;
    }).join('');
}

async function renderStatsGraficos() {
    if (!dbJogadores || dbJogadores.length === 0) return;

    const titulos = [...dbJogadores].sort((a,b) => (b.titulos_total || 0) - (a.titulos_total || 0)).filter(j => (j.titulos_total || 0) > 0);
    mkRanking('rankTitulos', titulos.length ? titulos.map(j => ({n: j.nome, v: j.titulos_total})) : [{n: 'Sem dados', v: 1}]);

    const finais = [...dbJogadores].sort((a,b) => (b.finais_total || 0) - (a.finais_total || 0)).filter(j => (j.finais_total || 0) > 0);
    mkRanking('rankFinais', finais.length ? finais.map(j => ({n: j.nome, v: j.finais_total})) : [{n: 'Sem dados', v: 1}]);

    const tList = document.getElementById('torniosList');
    if(tList && dbTorneios.length > 0) {
        const { data: todasPartidas } = await dbClient
            .from('partidas')
            .select('*, jogadores!campeao_id(nome)')
            .order('edicao', { ascending: true });

        const torneiosOrdenados = [...dbTorneios].sort((a, b) => (b.edicao_atual || 0) - (a.edicao_atual || 0));

        tList.innerHTML = torneiosOrdenados.map((t) => {
            const historico = todasPartidas ? todasPartidas.filter(p => p.torneio_id === t.id) : [];
            return `
                <div class="torneio-item" style="margin-bottom:10px; background:var(--s2); border-radius:8px; overflow:hidden;">
                    <button onclick="document.getElementById('t-hist-${t.id}').classList.toggle('show')"
                            style="width:100%; display:flex; justify-content:space-between; padding:15px; background:transparent; border:none; color:var(--text); font-weight:bold; cursor:pointer;">
                        <span style="font-size: 1.1rem;">🏆 ${t.nome}</span>
                        <span style="color:var(--gold);">${t.edicao_atual || 0} Edições ▼</span>
                    </button>
                    <div id="t-hist-${t.id}" class="historico-lista" style="display:none; padding:15px; background:var(--bg); border-top:1px solid var(--border); font-size:0.85rem; max-height:350px; overflow-y:auto;">
                        <div style="display:flex; justify-content:space-between; color:var(--gold); font-weight:bold; border-bottom:1px solid var(--s3); padding-bottom:8px; margin-bottom:10px;">
                            <span style="width:40px;">Ed.</span>
                            <span style="flex:1; text-align:center;">Confronto / Final</span>
                            <span style="width:70px; text-align:right;">Campeão</span>
                        </div>
                        ${historico.length > 0 ? historico.map(p => `
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:8px;">
                                <span style="color:var(--muted); width:40px; font-weight:bold;">${p.edicao}º</span>
                                <span style="flex:1; text-align:center;">${p.placar_detalhado}</span>
                                <span style="color:var(--green); width:70px; text-align:right; font-weight:bold;">${p.jogadores?.nome || '?'}</span>
                            </div>
                        `).join('') : '<p style="color:var(--muted); text-align:center;">Nenhum histórico no banco.</p>'}
                    </div>
                </div>
            `;
        }).join('');
    }
}

async function renderTitulosDetalhados() {
    const container = document.getElementById('titulosDetalhados');
    if (!container) return;

    const { data, error } = await dbClient
        .from('titulos_detalhados')
        .select('quantidade, jogadores(id, nome, titulos_total), torneios(nome)')
        .gt('quantidade', 0);

    if (error || !data || data.length === 0) {
        container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:16px">Nenhum dado encontrado.</p>';
        return;
    }

    const byPlayer = {};
    data.forEach(row => {
        const nome = row.jogadores?.nome;
        if (!nome) return;
        if (!byPlayer[nome]) byPlayer[nome] = { total: row.jogadores.titulos_total || 0, torneios: [] };
        byPlayer[nome].torneios.push({ nome: row.torneios?.nome || '?', qty: row.quantidade });
    });

    const ordenados = Object.entries(byPlayer).sort((a, b) => b[1].total - a[1].total);

    container.innerHTML = ordenados.map(([nome, info]) => {
        const ts = [...info.torneios].sort((a, b) => b.qty - a.qty);
        return `
        <div class="ptcard">
            <div class="ptcard-header">
                <span class="ptcard-name">${nome}</span>
                <span class="ptcard-total">${info.total} 🏆</span>
            </div>
            <div class="ptcard-badges">
                ${ts.map(t => `
                    <div class="ptbadge">
                        <span class="ptbadge-n">${t.qty}</span>
                        <span class="ptbadge-t">${t.nome}</span>
                    </div>`).join('')}
            </div>
        </div>`;
    }).join('');
}

function mkRanking(id, data){
  const el = document.getElementById(id);
  if(!el) return;
  const max = data[0].v || 1;
  el.innerHTML = data.map((d,i)=>{
    const pct = Math.round((d.v/max)*100);
    const cls = i===0?'r1':i===1?'r2':i===2?'r3':'rx';
    return `<div class="ritem">
      <div class="rbadge ${cls}">${i+1}</div>
      <div class="rinfo">
        <div class="rname">${d.n}</div>
        <div class="rbar"><div class="rbf" style="width:${pct}%"></div></div>
      </div>
      <div class="rval">${d.v}</div>
    </div>`;
  }).join('');
}

function tab(name, btn){
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  btn.classList.add('on');
  const page = document.getElementById('page-'+name);
  if(page) page.classList.add('on');
}

// ── INICIALIZAÇÃO ─────────────────────────────────────────────
render();
iniciarAuth();
fetchDatabase();
