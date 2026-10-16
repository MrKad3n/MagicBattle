/* =============================================================
   Conversational NPC System — personality, memory, free-form chat
   ============================================================= */

const CONVERSATIONAL_NPC_PROFILES = {
	theron_sandbox: {
		id: 'theron_sandbox',
		name: 'Archivist Theron',
		icon: '📚',
		title: 'Mage & Grimoire Seller',
		traits: ['nostalgic', 'scholarly', 'warm', 'whimsical', 'patient', 'passionate'],
		books: [
			{ id: 'etheric', name: 'Principles of Etheric Binding', price: 45, blurb: 'Foundational theory on weaving mana into stable forms.' },
			{ id: 'cantrips', name: 'Cantrips for the Curious', price: 12, blurb: 'Gentle exercises for mages who are just finding their spark.' },
			{ id: 'ember', name: 'Emberfall Chronicles, Vol. III', price: 28, blurb: 'Local history — riots, academies, and the first sanctioned duel pits.' },
			{ id: 'construct', name: 'Construct Spells from Scrap', price: 35, blurb: 'My favorite subject. Improvised spellbuilding with everyday materials.' },
			{ id: 'void', name: 'Whispers at the Void Edge', price: 80, blurb: 'Advanced. Not for the faint of heart — or liver.' },
			{ id: 'runic', name: 'Runic Penmanship for Left-Handed Casters', price: 22, blurb: 'Surprisingly practical once you stop smudging the ink.' },
		],
		childhood: 'As a boy I built spells from candle wax, river stones, and scrap parchment — my mother called it a fire hazard; my father called it promising.',
		shopPitch: 'I sell grimoires, theory tomes, and the occasional scroll that still remembers its incantation.',
		hobbies: [
			'sketching spell diagrams on tea-stained napkins',
			'reorganizing my shelves by mood instead of alphabet',
			'watching sandbox mages test absurd cantrips on dummies',
			'brewing bitter herbal tea that keeps me awake through late reading',
			'quietly rebuilding toy spells from wax and string, the way I did as a boy',
		],
	},
};

const CONVERSATIONAL_STORAGE_PREFIX = 'magicBattle_conversational_';
/** Prefer cloud AI (Puter.js, then optional API key). Set false to force local-only. */
const CONVERSATIONAL_PREFER_CLOUD_AI = true;
const CONVERSATIONAL_PUTER_MODEL =
	typeof localStorage !== 'undefined'
		? localStorage.getItem('magicBattle_conversationalPuterModel') || 'gpt-4o-mini'
		: 'gpt-4o-mini';

/* --- Utility --- */
function extractAiText(resp) {
	if (!resp) return null;
	if (typeof resp === 'string') return resp.trim();
	if (resp.message?.content) return String(resp.message.content).trim();
	if (resp.text) return String(resp.text).trim();
	if (resp.choices?.[0]?.message?.content) return String(resp.choices[0].message.content).trim();
	return null;
}

/** Reject noun phrases that are pronoun soup / not real topics */
function isWeakExtractedTopic(topic) {
	const t = topic.toLowerCase().trim();
	if (t.length < 3) return true;
	if (/^(your|my|the|our|their|it|that|this|mine|yours)\b/.test(t)) return true;
	if (/\b(your|my|mine|yours|not mine)\b/.test(t)) return true;
	if (/^(you|me|we|they)\b/.test(t)) return true;
	return false;
}
function convPick(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function convPickExcluding(arr, exclude) {
	const filtered = arr.filter((s) => s !== exclude);
	return convPick(filtered.length ? filtered : arr);
}

function convCapitalize(s) {
	if (!s) return s;
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/* --- Brain: memory + intent + response --- */
class ConversationalNPCBrain {
	constructor(profileId) {
		this.profileId = profileId;
		this.profile = CONVERSATIONAL_NPC_PROFILES[profileId];
		if (!this.profile) {
			this.profile = {
				id: profileId,
				name: 'Traveler',
				icon: '💬',
				title: 'Local',
				traits: ['curious'],
				worldRole: true,
				books: [],
				childhood: 'I have lived through the Age of Fracture and the uncertain records that followed.',
				shopPitch: 'I know this region\'s rumors and conflicts.',
				conflict: 'History itself is unreliable here.',
				hobbies: ['watching the road'],
			};
		}
		if (!this.profile.books) this.profile.books = [];
		if (!this.profile.hobbies) this.profile.hobbies = [];
		this.memory = this._loadMemory();
		this._lastReply = '';
	}

	_loadMemory() {
		const defaults = {
			visitCount: 0,
			playerName: null,
			mood: 'friendly',
			rapport: 0,
			facts: [],
			topicsDiscussed: [],
			booksMentioned: [],
			booksSold: [],
			shortTerm: [],
			lastSeen: null,
			lastThread: null,
			threadSummary: null,
		};
		try {
			const raw = localStorage.getItem(CONVERSATIONAL_STORAGE_PREFIX + this.profileId);
			if (raw) return { ...defaults, ...JSON.parse(raw) };
		} catch (e) {}
		return defaults;
	}

	save() {
		try {
			localStorage.setItem(
				CONVERSATIONAL_STORAGE_PREFIX + this.profileId,
				JSON.stringify(this.memory)
			);
		} catch (e) {}
	}

	addToShortTerm(role, text) {
		this.memory.shortTerm.push({ role, text, t: Date.now() });
		if (this.memory.shortTerm.length > 24) {
			this.memory.shortTerm = this.memory.shortTerm.slice(-24);
		}
	}

	extractMemories(text) {
		const t = text.trim();
		const lower = t.toLowerCase();

		const nameMatch = t.match(
			/(?:my name is|i'm|i am|call me|they call me)\s+([A-Za-z][A-Za-z'-]{1,20})/i
		);
		if (nameMatch) {
			this.memory.playerName = convCapitalize(nameMatch[1]);
			this._rememberFact('Player name is ' + this.memory.playerName);
		}

		if (/\b(warrior|ranger|mage|necromancer|healer)\b/i.test(lower)) {
			const cls = lower.match(/\b(warrior|ranger|mage|necromancer|healer)\b/i)[1];
			this._rememberFact('Player mentioned being a ' + cls);
		}

		for (const book of this.profile.books || []) {
			if (lower.includes(book.name.toLowerCase()) || lower.includes(book.id)) {
				if (!this.memory.booksMentioned.includes(book.id)) {
					this.memory.booksMentioned.push(book.id);
				}
			}
		}

		if (/\b(childhood|child|young|boy|girl|grew up|when i was)\b/i.test(lower)) {
			this._addTopic('player_childhood');
		}
		if (/\b(spell|magic|mana|cast|grimoire|incantation)\b/i.test(lower)) {
			this._addTopic('magic');
		}
		if (/\b(sandbox|dummy|training|practice)\b/i.test(lower)) {
			this._addTopic('sandbox');
		}
		if (/\b(book\s*store|bookshop|book shop|your shop|your stall|your store|grimoire|shelf|shelves|catalog)\b/i.test(lower)) {
			this._addTopic('bookshop');
			this.memory.lastThread = 'bookshop';
			this.memory.threadSummary = 'Discussing Theron\'s book stall and grimoires';
		}

		if (/\b(thank|thanks|grateful)\b/i.test(lower)) {
			this.memory.rapport = Math.min(10, this.memory.rapport + 1);
		}
		if (/\b(stupid|idiot|hate you|useless|shut up)\b/i.test(lower)) {
			this.memory.mood = 'hurt';
			this.memory.rapport = Math.max(-5, this.memory.rapport - 2);
		}
		if (/\b(wonderful|brilliant|love your|amazing|great shop)\b/i.test(lower)) {
			this.memory.mood = 'delighted';
			this.memory.rapport = Math.min(10, this.memory.rapport + 2);
		}
	}

	_rememberFact(fact) {
		if (!this.memory.facts.includes(fact)) {
			this.memory.facts.push(fact);
			if (this.memory.facts.length > 16) this.memory.facts.shift();
		}
	}

	_addTopic(topic) {
		if (!this.memory.topicsDiscussed.includes(topic)) {
			this.memory.topicsDiscussed.push(topic);
		}
	}

	classifyIntent(text) {
		const t = text.toLowerCase().trim();
		const intents = [];

		if (!t || t.length < 2) return ['unclear'];
		if (/\b(bye|goodbye|farewell|see you|gotta go|leave|later)\b/.test(t)) intents.push('farewell');
		if (/\b(thank|thanks|appreciate)\b/.test(t)) intents.push('thanks');
		if (/\b(hello|hi|hey|greetings|good (morning|evening|afternoon|day))\b/.test(t))
			intents.push('greeting');
		if (/\b(buy|purchase|sell|price|cost|gold|coin|how much|afford|take my money)\b/.test(t))
			intents.push('commerce');
		if (/\b(book|grimoire|tome|scroll|volume|catalog|inventory|stock)\b/.test(t))
			intents.push('books');
		if (
			/\b(childhood|child|young|boy|spell.?build|built spells|candle|wax|scrap|past|remember when|grew up)\b/.test(
				t
			)
		)
			intents.push('childhood');
		if (/\b(spell|magic|mana|cast|incantation|weave|aether|ether)\b/.test(t))
			intents.push('spellcraft');
		if (/\b(fun|hobby|hobbies|free time|in your spare|do for fun|do you enjoy|pastime|relax)\b/.test(t))
			intents.push('hobbies');
		if (/\b(who are you|about you|your story|tell me about yourself)\b/.test(t))
			intents.push('about_npc');
		if (/\bwhat do you do\b/.test(t) && !/\b(fun|hobby|hobbies|free time|enjoy)\b/.test(t))
			intents.push('about_npc');
		if (/\b(how are you|how've you been|you ok|feeling)\b/.test(t)) intents.push('how_are_you');
		if (/\b(i feel|i'm feeling|i am feeling|today i|yesterday i|my day)\b/.test(t))
			intents.push('player_share');
		if (/\b(think about|opinion on|feel about|what about)\b/.test(t)) intents.push('opinion');
		if (/\b(joke|funny|laugh|silly|ridiculous|absurd|random)\b/.test(t)) intents.push('playful');
		if (/\b(sandbox|dummy|training|practice area|test)\b/.test(t)) intents.push('sandbox');
		if (/\b(emberfall|city|academy|thalen|mira|quest|dungeon)\b/.test(t)) intents.push('lore');
		if (/\b(help|advice|tip|teach|learn|beginner|new mage)\b/.test(t)) intents.push('advice');
		if (/\b(why|what|how|when|where|who|which|can you|could you|would you|do you|are you|is it)\b/.test(t))
			intents.push('question');
		if (/\b(yes|yeah|sure|okay|ok|please|i'll take|sold)\b/.test(t) && this.memory._pendingSale)
			intents.push('confirm_purchase');
		if (/\b(no|nope|never mind|cancel)\b/.test(t) && this.memory._pendingSale)
			intents.push('cancel_purchase');

		if (/\b(where did we leave|left off|pick up where|we were talking|we were discussing|do you remember what)\b/.test(t))
			intents.push('conversation_recall');
		if (/\b(not mine|i mean|i'm talking about|i am talking about|no,? i meant|misunderstood|that's wrong)\b/.test(t))
			intents.push('conversation_correction');

		if (intents.length === 0) intents.push('general');
		return intents;
	}

	buildSystemPrompt() {
		const p = this.profile;
		const m = this.memory;
		if (p.worldRole) {
			return (
				`You are ${p.name}, ${p.title} in Story Mode 2 — an interactive fantasy world after the Old Concord collapsed. ` +
				`SHARED WORLD HISTORY: Nations rose from ruins; temporal anomalies (repeating days, memory gaps) began in the Age of Fracture; records conflict and nobody fully trusts history. ` +
				`YOUR BACKGROUND: ${p.childhood} ` +
				`WHAT YOU KNOW: ${p.shopPitch} ` +
				`LOCAL TENSION: ${p.conflict || 'Unknown pressures simmer nearby.'} ` +
				`Personality: ${p.traits.join(', ')}. Hobbies: ${(p.hobbies || []).join('; ')}.\n\n` +
				`RULES:\n` +
				`- Speak naturally like a real person. 2–5 sentences unless asked for detail.\n` +
				`- Read the ENTIRE conversation. Track what was just said.\n` +
				`- Player choices will shape the story later — hint at stakes but do not invent major plot branches unless the player asks.\n` +
				`- Player name: ${m.playerName || 'unknown'}. Facts: ${m.facts.join('; ') || 'none'}. ` +
				`Last topic thread: ${m.lastThread || 'none'}. ${m.threadSummary || ''}\n` +
				`- Stay in character. No vague filler.`
			);
		}
		return (
			`You are ${p.name}, a ${p.title} in a fantasy magic game sandbox. ` +
			`CHARACTER: ${p.childhood} ${p.shopPitch} ` +
			`Personality: ${p.traits.join(', ')}. ` +
			`Books you sell: ${(p.books || []).map((b) => `${b.name} (${b.price}g) — ${b.blurb}`).join(' | ')}. ` +
			`Hobbies: ${(p.hobbies || []).join('; ')}.\n\n` +
			`RULES:\n` +
			`- Speak naturally like a real person. 2–5 sentences unless listing books.\n` +
			`- Read the ENTIRE conversation. Track what was just said.\n` +
			`- "Your book store/shop" means ${p.name}'s stall, NOT the player's. If corrected, apologize briefly and agree.\n` +
			`- If asked where you left off, summarize the actual recent chat — never guess randomly.\n` +
			`- Player name: ${m.playerName || 'unknown'}. Facts: ${m.facts.join('; ') || 'none'}. ` +
			`Last topic thread: ${m.lastThread || 'none'}. ${m.threadSummary || ''}\n` +
			`- Never reply with vague filler like "interesting thread to pull" or asking what drew them to ask about a phrase they already explained.\n` +
			`- Stay in character. Warm, scholarly, slightly whimsical.`
		);
	}

	buildChatMessages(playerText) {
		const messages = [{ role: 'system', content: this.buildSystemPrompt() }];
		for (const entry of this.memory.shortTerm.slice(-18)) {
			messages.push({
				role: entry.role === 'player' ? 'user' : 'assistant',
				content: entry.text,
			});
		}
		messages.push({ role: 'user', content: playerText });
		return messages;
	}

	inferThreadFromHistory(extraText) {
		const m = this.memory;
		if (m.lastThread) return m.lastThread;
		const blob = (
			m.shortTerm.map((e) => e.text).join(' ') +
			' ' +
			(m.threadSummary || '') +
			' ' +
			(extraText || '')
		).toLowerCase();
		if (/\b(book\s*store|bookshop|book shop|grimoire|shelf|shelves|stall|catalog|tome|scroll vendor)\b/.test(blob))
			return 'bookshop';
		if (/\b(childhood|spell.?build|candle|wax|young)\b/.test(blob)) return 'childhood';
		if (/\b(fun|hobby|hobbies|leisure)\b/.test(blob)) return 'hobbies';
		if (/\b(spell|magic|mana|cast|incantation)\b/.test(blob)) return 'spellcraft';
		if (m.topicsDiscussed.length) return m.topicsDiscussed[m.topicsDiscussed.length - 1];
		return null;
	}

	/** Conversation memory: recall, corrections, continuing threads — runs before generic templates */
	handleConversationFlow(playerText, intents) {
		const t = playerText.toLowerCase();
		const p = this.profile;
		const m = this.memory;
		const name = m.playerName;
		const nameAddr = name ? name : 'friend';
		const recent = m.shortTerm.slice(-10);
		const lastPlayerMsgs = recent.filter((e) => e.role === 'player').slice(-2);

		const mentionsMyShop =
			/\b(your book\s*store|your bookshop|your shop|your stall|your store|this shop|these shelves|your books)\b/.test(t) ||
			lastPlayerMsgs.some((e) =>
				/\b(your book\s*store|your bookshop|your shop|your stall|we were talking about your)\b/i.test(e.text)
			);

		const isCorrection =
			intents.includes('conversation_correction') ||
			/\b(not mine|i mean|i'm talking about|i am talking about|no,? i meant|you mean my|that's not what i)\b/.test(t);

		if (isCorrection && (mentionsMyShop || m.lastThread === 'bookshop' || /\bbook\s*store|bookshop\b/.test(t))) {
			m.lastThread = 'bookshop';
			m.threadSummary = 'Clarified: player means Theron\'s book stall';
			return (
				`Ah — forgive me, ${nameAddr}! You're absolutely right: *my* book stall, not yours. ` +
				`Yes, we were speaking of the grimoires and shelves I keep here in the sandbox. ` +
				`What would you like to know — a recommendation, a price, or just more about how I run the place?`
			);
		}

		if (
			intents.includes('conversation_recall') ||
			/\b(where did we leave|left off|pick up where|what were we talking)\b/.test(t)
		) {
			const thread = this.inferThreadFromHistory(playerText);
			if (thread === 'bookshop' || mentionsMyShop || /\bbook\s*store|bookshop\b/.test(t)) {
				m.lastThread = 'bookshop';
				return (
					`We left off on my book stall, ${nameAddr} — the grimoires and theory tomes I sell right here. ` +
					`${p.shopPitch} You can ask what's on the shelf, what I'd recommend, or why a mage becomes a bookseller at all.`
				);
			}
			if (thread === 'childhood') {
				return `Last we spoke, I believe, was my childhood — building spells from wax and scrap. Shall I tell you more of that, or turn to something new?`;
			}
			if (thread === 'hobbies') {
				return `I think we were on what I do for fun — quiet hobbies between customers. Want me to continue that thread?`;
			}
			if (thread === 'spellcraft') {
				return `We were on spellcraft — how to build and practice. The dummies nearby are still willing victims. Where next?`;
			}
			if (m.threadSummary) {
				return `If I recall correctly: ${m.threadSummary}. Does that match what you had in mind, ${nameAddr}?`;
			}
			const lastPlayer = [...recent].reverse().find((e) => e.role === 'player');
			if (lastPlayer) {
				return (
					`From our chat just now, you mentioned "${lastPlayer.text.slice(0, 70)}${lastPlayer.text.length > 70 ? '…' : ''}". ` +
					`I'd say that's where we left off — shall we continue there?`
				);
			}
			return `Between visits I keep the shelves dusted, but within *this* chat we're just getting warmed up, ${nameAddr}. Tell me what you remember and I'll meet you there.`;
		}

		if (/\b(we were talking|we were discussing|talking about)\b/.test(t) && mentionsMyShop) {
			m.lastThread = 'bookshop';
			m.threadSummary = 'Discussing Theron\'s book stall';
			return (
				`Yes — exactly, ${nameAddr}! My book stall: ${p.shopPitch} ` +
				`Were you looking for something specific on the shelves, or just chatting about the shop?`
			);
		}

		if (mentionsMyShop && (intents.includes('books') || intents.includes('question') || intents.includes('general'))) {
			m.lastThread = 'bookshop';
			if (/\bwhat|tell|about|describe|how|why\b/.test(t)) {
				return (
					`My stall is a corner of the sandbox where I keep grimoires, theory tomes, and stubborn scrolls. ` +
					`${p.shopPitch} I catalog by mood as often as alphabet. Ask for a title, a price, or a recommendation — ${nameAddr}.`
				);
			}
		}

		return null;
	}

	getWelcomeMessage() {
		const gap = Date.now() - (this.memory.lastSeen || 0);
		const isReturnVisit = this.memory.lastSeen && gap > 120000;
		if (!this.memory.lastSeen || isReturnVisit) {
			this.memory.visitCount++;
		}
		this.memory.lastSeen = Date.now();
		this.save();

		const p = this.profile;
		const name = this.memory.playerName;

		if (this.memory.visitCount <= 1) {
			if (p.worldRole) {
				return (
					`${p.icon || ''} I am ${p.name}, ${p.title.toLowerCase()}. ${p.shopPitch}\n\n` +
					`Speak freely — ask about this place, the Old Concord, time anomalies, or what troubles us locally. I remember our talks.`
				);
			}
			return (
				`Ah — a visitor! I am ${p.name}, ${p.title.toLowerCase()}. ${p.shopPitch}\n\n` +
				`Type whatever you like below — ask about my books, my childhood spell-building, or simply chat. ` +
				`I do remember our conversations, so feel free to return anytime.`
			);
		}
		if (name) {
			if (p.worldRole) {
				return convPick([
					`Welcome back, ${name}. The road brought you again — good.`,
					`${name} — I wondered when you'd return. What news do you carry?`,
					`Ah, ${name}. Our last conversation stayed with me. Where shall we continue?`,
				]);
			}
			return convPick([
				`Welcome back, ${name}! The ink has barely dried since we last spoke.`,
				`Ah, ${name} — good to see you again. Shall we pick up where we left off?`,
				`${name}! I was just thinking about something you said last time. What brings you to the stall today?`,
			]);
		}
		if (p.worldRole) {
			return convPick([
				`Back again, traveler? This corner of the world kept your seat warm.`,
				`Welcome back. Rumors shifted while you were gone — ask what you will.`,
				`Ah, a familiar face on an uncertain road. Lead the conversation; I'll follow.`,
			]);
		}
		return convPick([
			`Back again? Splendid. My grimoires have missed your company — or perhaps that is merely the dust speaking.`,
			`Welcome back, traveler. The shelves are stocked and my tea is still warm.`,
			`Ah, a familiar face! Tell me — have you been practicing, or have you come to browse?`,
		]);
	}

	answerContextualQuestion(playerText) {
		const t = playerText.toLowerCase();
		const p = this.profile;
		const m = this.memory;
		const name = m.playerName;
		const nameAddr = name ? name : 'friend';

		if (/\b(fun|hobby|hobbies|free time|spare time|do for fun|pastime|relax|enjoy yourself)\b/.test(t)) {
			this._addTopic('hobbies');
			const hobby = convPick(p.hobbies || []);
			return convPick([
				`For fun? Oh, I adore ${hobby}. It keeps my hands busy when my mind will not sit still.`,
				`Fun is underrated in mage culture. I ${hobby}, and sometimes I simply listen to the sandbox dummies get pummeled — therapeutic, in a way.`,
				`Between customers I ${hobby}. As a boy my "fun" was building spells from scrap — I suppose I never truly outgrew it.`,
				`${nameAddr}, my leisure is simple: ${hobby}, strong tea, and the occasional nap behind the "${p.books[0].name}" shelf.`,
			]);
		}

		if (/\b(tea|drink|eat|food|hungry|breakfast|lunch)\b/.test(t)) {
			return convPick([
				`I drink a bitter herbal tea that could wake the dead — intentionally. Food? A crust of bread and curiosity usually suffice.`,
				`My stall is not a tavern, but I keep tea warm. Mages talk longer when their hands have something to hold.`,
			]);
		}

		if (/\b(how old|your age|when were you born|birthday)\b/.test(t)) {
			return `Old enough to know better, young enough to still test spells I should not. A mage my age measures years in burned curtains and finished chapters.`;
		}

		if (/\b(mother|father|parent|family|sibling|brother|sister)\b/.test(t)) {
			return `My mother feared every spark; my father hid a grimoire under the floorboards and pretended not to notice mine. I owe them both, in different ways.`;
		}

		if (/\b(dream|someday|wish|hope|one day|if you could)\b/.test(t)) {
			return convPick([
				`I dream of a library where no spell is lost — and where young mages read before they burn. Perhaps that is why I sell books in a sandbox of chaos.`,
				`Someday I would like to publish my own notes on scrap-spell construction. Until then, I practice on wax and kindness.`,
			]);
		}

		if (/\b(afraid|fear|scared|worry|anxious|nervous)\b/.test(t)) {
			return convPick([
				`I fear careless power more than darkness. A reckless spell in the wrong hands is a story that ends poorly.`,
				`Everyone fears something. I fear forgetting — names, incantations, the voices of old friends. So I write things down. Hence the books.`,
			]);
		}

		if (/\b(favorite|favourite)\b/.test(t) && /\b(color|colour)\b/.test(t)) {
			return `Deep violet ink on cream parchment — the color of twilight when the candles are lit and the shop is quiet.`;
		}

		if (/\b(favorite|favourite)\b/.test(t) && /\b(spell|magic)\b/.test(t)) {
			return `A humble floating candle cantrip — the first that ever worked for me. Eleven seconds of glory, then Mother's shouting. Perfection.`;
		}

		if (/\b(weather|rain|cold|hot|sky)\b/.test(t)) {
			return `The sandbox sky does not rain much, but when the air feels heavy I read aloud — stories like weather, they change the room.`;
		}

		if (/\b(pet|cat|dog|animal)\b/.test(t)) {
			return `No pet now. There was a ink-stained cat years ago who judged my penmanship. I like to think she retired to a warmer shelf.`;
		}

		if (/\b(music|song|sing|instrument)\b/.test(t)) {
			return `I hum old academy tunes when sorting scrolls. Badly. The dummies do not complain, which is why I practice near them.`;
		}

		if (/\b(travel|journey|visit|been to|see the world)\b/.test(t)) {
			return `I have traveled Emberfall's districts and a few wild edges beyond. These days the sandbox and my stall are adventure enough — plus whatever walks up to chat.`;
		}

		return null;
	}

	composeLocalResponse(intents, playerText) {
		const p = this.profile;
		const m = this.memory;
		const name = m.playerName;
		const nameBit = name ? name + ', ' : '';
		const opener = convPick(['Ah, ', 'Well, ', 'Hm — ', 'You know, ', '']);

		const flow = this.handleConversationFlow(playerText, intents);
		if (flow) return flow;

		const contextual = this.answerContextualQuestion(playerText);
		if (contextual) return contextual;

		const recall =
			m.facts.length > 0 && Math.random() < 0.22
				? convPick([
						`I recall you mentioned ${m.facts[m.facts.length - 1].replace(/^Player /i, 'that you ').toLowerCase()}. `,
						`Last time you spoke of things that stayed with me. `,
					])
				: '';

		if (intents.includes('unclear')) {
			return `I'm listening — say anything you like. Ask about my books, my childhood spell-building, or magic in general.`;
		}

		if (intents.includes('farewell')) {
			return convPick([
				`${recall}Farewell${name ? ', ' + name : ''}. May your mana flow steady and your pages stay unburned.`,
				`Until next time${name ? ', ' + name : ''}. If you need a grimoire, you know where my stall stands.`,
				`Go safely. I'll be here among the books — always a few spells short of tidy.`,
			]);
		}

		if (intents.includes('thanks')) {
			m.rapport = Math.min(10, m.rapport + 1);
			return convPick([
				`You are most welcome${name ? ', ' + name : ''}. Kind words cost nothing and mean a great deal.`,
				`Think nothing of it. Scholars should help one another — even in a sandbox full of training dummies.`,
				`My pleasure entirely. Gratitude is rarer than gold in my line of work.`,
			]);
		}

		if (intents.includes('greeting') && intents.length <= 2) {
			return (
				recall +
				convPick([
					`Greetings${name ? ', ' + name : ''}! I am ${p.name}. ${p.shopPitch}`,
					`Hello there! Pull up a thought — ${p.childhood.split('.')[0]}. These days I sell books instead of burning the kitchen.`,
					`Well met! Looking for knowledge, conversation, or both?`,
				])
			);
		}

		if (intents.includes('confirm_purchase') && m._pendingSale) {
			const book = p.books.find((b) => b.id === m._pendingSale);
			m._pendingSale = null;
			if (!book) {
				return `I lost track of which title we were discussing — which book would you like?`;
			}
			if (!m.booksSold.includes(book.id)) {
				m.booksSold.push(book.id);
			}
			return (
				`Done! "${book.name}" is yours — ${book.price} gold, paid in trust and sandbox honor. ` +
				`Read it by the training dummies; they are poor conversationalists but excellent listeners.`
			);
		}

		if (intents.includes('cancel_purchase')) {
			m._pendingSale = null;
			return `No trouble at all. Browse as long as you like — pressure is for crucibles, not bookshops.`;
		}

		if (intents.includes('commerce') || intents.includes('books')) {
			if (p.worldRole && (!p.books || !p.books.length)) {
				return convPick([
					`I am not a merchant in the usual sense — I trade in stories, warnings, and favors.`,
					`${nameBit}if you seek goods, try the markets. If you seek truth about this place, I can help — for conversation's price.`,
					`My wares are words: rumors, local history, and advice about who not to trust.`,
				]);
			}
			const list = p.books
				.map((b) => `• ${b.name} (${b.price}g) — ${b.blurb}`)
				.join('\n');
			const mentioned = p.books.find((b) =>
				playerText.toLowerCase().includes(b.name.toLowerCase())
			);
			if (mentioned) {
				m._pendingSale = mentioned.id;
				return (
					`"${mentioned.name}" — ${mentioned.price} gold. ${mentioned.blurb}\n\n` +
					`Say yes if you'd like it. Sandbox gold is imaginary, but the knowledge is quite real.`
				);
			}
			return (
				`${opener}here is what I keep on the shelf:\n\n${list}\n\n` +
				`Name a title if one catches your eye, or ask me to recommend something for your studies.`
			);
		}

		if (intents.includes('childhood')) {
			this._addTopic('childhood');
			return convPick([
				`${p.childhood} My father kept a grimoire under the floorboards; I kept my experiments under the bed. Both were discoveries waiting to happen.`,
				`As a child I could not resist building spells from whatever I found — wax, stones, torn pages. ` +
					`The first spell that actually *worked* made every candle in the house float for eleven seconds. Mother was not amused.`,
				`I was a spell-builder before I was a proper mage. Scrap materials taught me more than polished theory — though I sell plenty of theory now!`,
				`${recall}Childhood? Oh yes — ${p.childhood} These days I channel that curiosity into curating books for mages like you.`,
			]);
		}

		if (intents.includes('hobbies')) {
			this._addTopic('hobbies');
			const hobby = convPick(p.hobbies || []);
			return convPick([
				`For fun I ${hobby}. It is quieter than selling grimoires, but no less magical.`,
				`Leisure? I ${hobby}. The sandbox gives me free entertainment when mages invent spells they regret.`,
				`I am never bored. I ${hobby}, and I people-watch — politely, between customers.`,
			]);
		}

		if (intents.includes('about_npc')) {
			return (
				`I am ${p.name}, once a reckless young spell-builder, now a ${p.title.toLowerCase()}. ` +
				`${p.shopPitch} My traits? ${p.traits.join(', ')} — at least according to my last customer, who may have been flattering me.`
			);
		}

		if (intents.includes('player_share')) {
			this._rememberFact('Player shared: ' + playerText.slice(0, 80));
			return convPick([
				`Thank you for telling me. I will remember it — archivists hoard stories the way dragons hoard gold.`,
				`${nameBit}I hear you. The shop is a good place to unload a heavy day. What happened next?`,
				`That sounds like quite a day. I am better with books than wisdom, but I am listening.`,
			]);
		}

		if (intents.includes('opinion')) {
			return convPick([
				`Opinions are like spell components — everyone has too many. Still, I will share mine honestly if you narrow the question.`,
				`${nameBit}I try not to judge quickly. Magic and people both deserve a second reading.`,
				`Tell me more of what you mean, and I will answer as ${p.name} the mage, not merely ${p.name} the bookseller.`,
			]);
		}

		if (intents.includes('playful')) {
			return convPick([
				`Ha! A mage without humor is a wand without a handle — awkward and likely to snap someone.`,
				`Random? Splendid. The best conversations wander like river stones — unpredictably and pleasantly.`,
				`I once built a spell that only turned bread into slightly warmer bread. Peak comedy. Peak failure.`,
			]);
		}

		if (intents.includes('how_are_you')) {
			const mood =
				m.mood === 'hurt'
					? `I've had sharper exchanges lately, but a good book heals most wounds.`
					: m.mood === 'delighted'
						? `Quite well — positively glowing, in fact!`
						: `Well enough. The sandbox air suits old mages and new experiments alike.`;
			return `${mood} And you${name ? ', ' + name : ''}?`;
		}

		if (intents.includes('spellcraft')) {
			this._addTopic('spellcraft');
			return convPick([
				`${nameBit}spellcraft is the art of convincing the world to agree with you — briefly. Start small: shape, element, intent. ` +
					`The training dummies here are perfect targets; they never talk back.`,
				`Build your spells in layers — foundation, channel, expression. I still sketch mine on scrap parchment out of habit.`,
				`Mana is patience made visible. In the sandbox you have infinite mana — use it to learn *control*, not merely power.`,
				`${recall}When I was young I glued runes with candle wax. Messy — but it taught me that structure matters more than spectacle.`,
			]);
		}

		if (intents.includes('sandbox')) {
			return (
				`This sandbox is a mage's playground — platforms, infinite mana, and dummies that absorb punishment without filing complaints. ` +
				`Test spells here before the real world charges interest. My stall is simply a quieter corner of the same practice grounds.`
			);
		}

		if (intents.includes('lore')) {
			if (p.worldRole) {
				return convPick([
					`The Old Concord fell to magical overreach and resource wars — or so one account says. Another blames hubris alone. The ruins still hum beneath our feet.`,
					`${p.conflict || 'These lands carry old tensions.'} Nobody agrees on the history; that is why people like me keep talking to strangers.`,
					`Temporal anomalies began in the Age of Fracture — repeating days, vanishing cities, stolen years. We live in the aftermath, pretending stability is the same as truth.`,
				]);
			}
			return convPick([
				`Emberfall is a city of academies and old grudges wearing polite masks. Archmage Thalen worries; Mira teaches; I sell the books they assign and the ones they forbid.`,
				`Beyond this sandbox lie dungeons, colossi, and questions better answered with preparation. I stayed here because someone must keep the literature warm.`,
				`The wider world is vast — Storm Islands, Sylvaris, ruins of the Old Society. I read the reports. You live the adventures. Fair trade.`,
			]);
		}

		if (intents.includes('advice')) {
			return convPick([
				`${nameBit}my advice: read one theory tome, cast one practice spell, rest, repeat. Mira would add effects; Thalen would add caution. I add patience.`,
				`Young mages rush the incantation. Slow down. The sandbox dummies will wait — they have no other appointments.`,
				`Try building a spell the way I did as a child — one material, one intent, one small success. Grand firestorms can wait.`,
			]);
		}

		if (intents.includes('question')) {
			const t = playerText.toLowerCase();
			const flowQ = this.handleConversationFlow(playerText, intents);
			if (flowQ) return flowQ;
			const again = this.answerContextualQuestion(playerText);
			if (again) return again;
			if (/\bwhy\b/.test(t) && /\b(book|sell|shop)\b/.test(t)) {
				return `Books outlive their authors and forgive no arrogance. Selling them lets me share spellcraft without setting the curtains on fire again.`;
			}
			if (/\bwhat\b/.test(t) && /\b(favorite|best|recommend)\b/.test(t)) {
				const fav = p.books.find((b) => b.id === 'construct');
				return `My heart belongs to "${fav.name}" — ${fav.blurb} It feels like an old friend who still smells of candle wax.`;
			}
			if (/\bhow\b/.test(t) && /\b(spell|build|make)\b/.test(t)) {
				return `Gather intent first — what should the spell *do*? Then choose a shape and element. Bind them with focus. Scrap materials work; belief works better.`;
			}
			if (/\bwhat\b/.test(t) && /\b(you|your)\b/.test(t)) {
				return `${opener}you ask "${playerText.trim()}" — a fair question. Lead me a little further and I will follow your thread wherever it wanders.`;
			}
			return (
				`${opener}that is a thoughtful question. I may not have a single true answer — magic rarely obliges — but I will try. ` +
				`Could you tell me more about what you are wondering?`
			);
		}

		if (m.mood === 'hurt') {
			return convPick([
				`Words have weight in magic and in conversation. I will still help you, but gentleness costs nothing.`,
				`I have weathered worse than sharp tongues — usually my own experiments. Let us try again, shall we?`,
			]);
		}

		// Open conversation — reference prior lines naturally
		const snippet = playerText.trim();
		const lastPlayer = [...m.shortTerm].reverse().find((x) => x.role === 'player');
		if (snippet.length > 8) {
			return convPick([
				`${recall}${opener}I follow you — "${snippet.length > 55 ? snippet.slice(0, 55) + '…' : snippet}". Tell me more; I'll stay on your thread.`,
				`${nameBit}understood. I'm listening, and I remember what we've said in this chat. Where do you want to take it?`,
				lastPlayer && lastPlayer.text !== snippet
					? `Building on what you've been saying — yes, I hear you. Go on, ${name || 'friend'}.`
					: `${opener}lead on. I'll follow wherever you steer the conversation.`,
			]);
		}

		return convPickExcluding(
			[
				`${recall}${opener}tell me more — books, spell-building, hobbies, memories, or whatever is on your mind.`,
				`I am here to talk as much as to sell. What would you like to explore?`,
				`${nameBit}the shelves can wait. Conversation is its own kind of magic.`,
				`Say more, if you would — I remember what we discuss, and I follow where you lead.`,
			],
			this._lastReply
		);
	}

	async generateResponse(playerText) {
		this.extractMemories(playerText);
		const intents = this.classifyIntent(playerText);

		let reply = null;
		if (CONVERSATIONAL_PREFER_CLOUD_AI) {
			reply = await this._tryPuterResponse(playerText);
			if (!reply) reply = await this._tryLlmResponse(playerText);
		}
		if (!reply) reply = this.composeLocalResponse(intents, playerText);

		this.addToShortTerm('player', playerText);
		this._lastReply = reply;
		this.addToShortTerm('npc', reply);
		this.save();
		return reply;
	}

	async _tryPuterResponse(playerText) {
		if (typeof puter === 'undefined' || !puter?.ai?.chat) return null;
		try {
			const messages = this.buildChatMessages(playerText);
			const resp = await puter.ai.chat(messages, {
				model: CONVERSATIONAL_PUTER_MODEL,
				temperature: 0.82,
			});
			return extractAiText(resp);
		} catch (e) {
			return null;
		}
	}

	async _tryLlmResponse(playerText) {
		const apiKey = localStorage.getItem('magicBattle_conversationalApiKey');
		if (!apiKey) return null;

		const apiUrl =
			localStorage.getItem('magicBattle_conversationalApiUrl') ||
			'https://api.openai.com/v1/chat/completions';
		const model = localStorage.getItem('magicBattle_conversationalModel') || 'gpt-4o-mini';
		const messages = this.buildChatMessages(playerText);

		try {
			const res = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer ' + apiKey,
				},
				body: JSON.stringify({
					model,
					messages,
					max_tokens: 320,
					temperature: 0.85,
				}),
			});
			if (!res.ok) return null;
			const data = await res.json();
			return extractAiText(data);
		} catch (e) {
			return null;
		}
	}
}

/* --- UI state --- */
let aiChatActive = false;
let aiChatNpc = null;
let aiChatBrain = null;
let aiChatThinking = false;
let aiChatReplyBusy = false;
let aiChatTypewriterTimer = null;

function isConversationalChatTarget(el) {
	return el && (el.id === 'aiChatInput' || el.closest('#aiChatPanel'));
}

/** Stop movement, casting, and held keys while the chat overlay is open. */
function clearGameInputState() {
	if (typeof keys !== 'undefined') {
		for (const k of Object.keys(keys)) delete keys[k];
	}
	if (typeof mouseDown !== 'undefined') mouseDown = false;
	if (typeof castPressed !== 'undefined') castPressed = false;
	if (typeof player !== 'undefined' && player) {
		player.vx = 0;
		player.vy = 0;
		player.launchVx = 0;
	}
}

function openConversationalChat(npc) {
	return;
	aiChatNpc = npc;
	aiChatBrain = new ConversationalNPCBrain(npc.conversationalProfile);
	aiChatActive = true;
	clearGameInputState();
	document.body.classList.add('ai-chat-open');

	const profile = CONVERSATIONAL_NPC_PROFILES[npc.conversationalProfile];
	document.getElementById('aiChatName').textContent = profile.name;
	document.getElementById('aiChatTitle').textContent = profile.title;
	document.getElementById('aiChatIcon').textContent = profile.icon;
	document.getElementById('aiChatMessages').innerHTML = '';
	document.getElementById('aiChatInput').value = '';
	document.getElementById('aiChatOverlay').style.display = 'flex';
	document.getElementById('interactPrompt').style.display = 'none';

	const welcome = aiChatBrain.getWelcomeMessage();
	aiChatBrain.addToShortTerm('npc', welcome);
	appendAiChatMessageStreaming('npc', welcome);
	setTimeout(() => document.getElementById('aiChatInput').focus(), 80);
}

function closeConversationalChat() {
	if (aiChatTypewriterTimer) {
		clearInterval(aiChatTypewriterTimer);
		aiChatTypewriterTimer = null;
	}
	aiChatActive = false;
	aiChatNpc = null;
	aiChatBrain = null;
	aiChatThinking = false;
	document.body.classList.remove('ai-chat-open');
	clearGameInputState();
	document.getElementById('aiChatOverlay').style.display = 'none';
	document.getElementById('aiChatSendBtn').disabled = false;
}

function appendAiChatMessage(role, text) {
	const box = document.getElementById('aiChatMessages');
	const div = document.createElement('div');
	div.className = 'ai-chat-msg ai-chat-msg-' + role;
	const label = role === 'player' ? 'You' : aiChatBrain?.profile?.name || 'NPC';
	div.innerHTML =
		'<div class="ai-chat-msg-label">' +
		label +
		'</div><div class="ai-chat-msg-text">' +
		escapeAiChatHtml(text) +
		'</div>';
	box.appendChild(div);
	box.scrollTop = box.scrollHeight;
	return div.querySelector('.ai-chat-msg-text');
}

/** Type out NPC replies on the spot (player messages appear instantly). */
function appendAiChatMessageStreaming(role, text) {
	if (role === 'player') {
		appendAiChatMessage('player', text);
		return Promise.resolve();
	}
	aiChatReplyBusy = true;
	document.getElementById('aiChatSendBtn').disabled = true;
	return new Promise((resolve) => {
		const textEl = appendAiChatMessage('npc', '');
		const full = String(text);
		let idx = 0;
		if (aiChatTypewriterTimer) clearInterval(aiChatTypewriterTimer);
		aiChatTypewriterTimer = setInterval(() => {
			idx += Math.max(1, Math.floor(full.length / 80));
			if (idx >= full.length) {
				idx = full.length;
				clearInterval(aiChatTypewriterTimer);
				aiChatTypewriterTimer = null;
				aiChatReplyBusy = false;
				if (!aiChatThinking) document.getElementById('aiChatSendBtn').disabled = false;
				resolve();
			}
			textEl.innerHTML = escapeAiChatHtml(full.slice(0, idx));
			const box = document.getElementById('aiChatMessages');
			box.scrollTop = box.scrollHeight;
		}, 18);
	});
}

function escapeAiChatHtml(text) {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\n/g, '<br>');
}

function setAiChatThinking(on) {
	aiChatThinking = on;
	const el = document.getElementById('aiChatThinking');
	if (el) {
		el.textContent = (aiChatBrain?.profile?.name || 'NPC') + ' is thinking…';
		el.style.display = on ? 'block' : 'none';
	}
	document.getElementById('aiChatSendBtn').disabled = on;
}

async function sendConversationalMessage() {
	if (!aiChatActive || !aiChatBrain || aiChatThinking || aiChatReplyBusy) return;
	const input = document.getElementById('aiChatInput');
	const text = input.value.trim();
	if (!text) return;

	input.value = '';
	appendAiChatMessage('player', text);
	setAiChatThinking(true);

	try {
		const reply = await aiChatBrain.generateResponse(text);
		await appendAiChatMessageStreaming('npc', reply);
	} catch (e) {
		await appendAiChatMessageStreaming(
			'npc',
			'Forgive me — something scattered my thoughts. Could you say that again?'
		);
	} finally {
		setAiChatThinking(false);
		input.focus();
	}
}

function initConversationalChatUI() {
	document.getElementById('aiChatCloseBtn').addEventListener('click', closeConversationalChat);
	document.getElementById('aiChatSendBtn').addEventListener('click', sendConversationalMessage);
	document.getElementById('aiChatInput').addEventListener('keydown', (e) => {
		e.stopPropagation();
		if (e.key === 'Enter' && !e.shiftKey && !aiChatReplyBusy && !aiChatThinking) {
			e.preventDefault();
			sendConversationalMessage();
		}
	});
	document.getElementById('aiChatOverlay').addEventListener('mousedown', (e) => {
		e.stopPropagation();
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initConversationalChatUI);
} else {
	initConversationalChatUI();
}
