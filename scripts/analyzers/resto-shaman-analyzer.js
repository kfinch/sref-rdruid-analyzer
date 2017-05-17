/**
 * RESTO SHAMAN ANALYZER
 *		
 *	Calculates the benefit of a resto shaman's mastery.
 *	Includes:
 *		- Mean health of t
 *		- Amount of healing benefit, both as a raw number and as a % of your total healing.
 *
 */
class RestoShamanSubAnalyzer {
	
	constructor(playerName, playerInfo, fight, enemyNameMapping) {
		this.playerName = playerName;
		this.playerInfo = playerInfo;
		this.fight = fight;
		this.enemyNameMapping = enemyNameMapping;
		
		this.shamanBlueColor = '0000ff'; // not actually the exact color -- just a 1st guess
		this.darkGrayColor = '888888';
		
		// these are the spells that can be boosted by Mastery
		this.shamanHeals = new Map();
		this.shamanHeals.set(77472, "Healing Wave");
		this.shamanHeals.set(8004, "Healing Surge");

		// this.druidHeals = new Map();
		// this.druidHeals.set(8936, "Regrowth");
		// this.druidHeals.set(774, "Rejuvenation");
		// this.druidHeals.set(155777, "Germination");
		// this.druidHeals.set(48438, "Wild Growth");
		// this.druidHeals.set(207386, "Spring Blossoms");
		// this.druidHeals.set(200389, "Cultivation");
		// this.druidHeals.set(102352, "Cenarion Ward");
		// this.druidHeals.set(33763, "Lifebloom");
		// this.druidHeals.set(22842, "Frenzied Regeneration");
		// this.druidHeals.set(5185 , "Healing Touch"); // y u casting it tho?
		// this.druidHeals.set(18562 , "Swiftmend");
		// // Living Seed doesn't directly benefit, but does through Regrowth.
		// // Including it on its own is technically wrong because it might heal with
		// // a different number of HoTs present than the Regrowth that spawned it.
		// // However, this is still a reasonable approximation.
		// this.druidHeals.set(48503 , "Living Seed");
		// this.druidHeals.set(157982 , "Tranquility");
		// this.druidHeals.set(81269 , "Effloresence");
		// this.druidHeals.set(189853 , "Dreamwalker");
		// this.druidHeals.set(189800 , "Nature's Essence");
		// this.druidHeals.set(33778, "Lifebloom Bloom");
		// Ysera's Gift and Renewal don't benefit from Mastery,
		// presumably because they already scale with your max health.
		
		// these are the spells that cause Mastery boosting
		// this.hots = new Map();
		// this.hots.set(8936, "Regrowth");
		// this.hots.set(774, "Rejuvenation");
		// this.hots.set(155777, "Germination");
		// this.hots.set(48438, "Wild Growth");
		// this.hots.set(207386, "Spring Blossoms");
		// this.hots.set(200389, "Cultivation");
		// this.hots.set(102352, "Cenarion Ward");
		// this.hots.set(33763, "Lifebloom");
		// this.hots.set(22842, "Frenzied Regeneration"); // yes, it actually counts towards mastery -_-
		
		// this.masteryBuffs = new Map(); // map from buff ID to obj with buff name and buff strength
		// this.masteryBuffs.set(232378, {'amount':4000, 'name':'T19 2pc'});
		// this.masteryBuffs.set(224149, {'amount':3000, 'name':"Jacin's Ruse"});	
		// TODO: any other common buffs to add? What will I do about varying buff strength by item ilevel?
		
		this.baseMasteryPercent = 21; // TODO need to verify
		this.masteryRatingPerOne = 133.33;
		
		this.playerId = this.playerInfo.sourceID;
		
		this.totalHealing = 0; // total healing from all spells
		this.totalNoMasteryHealing = 0; // total healing before mastery
		this.shamanSpellNoMasteryHealing = 0; // total healing before mastery from spells that benefit from mastery
		//this.druidSpellNoMasteryHealing = 0; // total healing before mastery from spells that benefit from mastery
		//this.masteryTimesHealing = 0; // for calculating avg mastery stacks
		
		this.spellHealingMap = new Map(); // map from the spell ID to obj with the direct and mastery healing
		for(let spellId of this.shamanHeals.keys()) {
			this.spellHealingMap.set(spellID, {'direct':0, 'mastery':0});
		}
		// this.hotHealingMap = new Map(); // map from hot ID to obj w/ direct healing and mastery healing
		// for(let hotId of this.hots.keys()) {
		// 	this.hotHealingMap.set(hotId, {'direct':0, 'mastery':0});
		// }
		
		// this.hotsOnTarget = new Map(); // map from player ID to a set of hot IDs
		// this.baseMasteryRating = this.playerInfo.mastery;
		// this.masteryBuffsActive = new Map(); // map from buff ID to obj with buff name and buff strength
		
		// // TODO: 3 maps just for the mastery buff? Make this implementation suck less.
		// this.masteryBuffAccum = new Map(); // map from buff ID to obj with buff name and healing attributable to it
		// for(let[buffId, buffObj] of this.masteryBuffs.entries()) {
		// 	this.masteryBuffAccum.set(buffId, {'attributableHealing':0, 'name':buffObj.name});
		// }
	}
	
	
	
	/*
	 * Methodology:
	 * Per friendly target, track their current health. When analyzed spells
	 * heal the friendly target, calculate how much was due to mastery, and add
	 * that to a running total. Be careful to handle overhealing correctly by
	 * only adding the contribution from mastery that did not go into more
	 * overhealing.
	 * 
	 * Shortcomings:
	 * 
	 */
	 parse(wclEvent) {
		 
		if(wclEvent.type === 'combatantinfo') {
			this.combatantInfo(wclEvent);
		}
		 
		if(wclEvent.sourceID !== this.playerId) {
			return;
		}
		
		switch( wclEvent.type ) {
			// case 'applybuff' :
			// 	this.applyBuff(wclEvent);
			// 	break;
			// case 'removebuff' :
			// 	this.removeBuff(wclEvent);
			// 	break;
			case 'heal' :
				this.heal(wclEvent);
				break;
			case 'absorbed' :
				this.absorbed(wclEvent);
				break;
			default :
		}
	}
	
	// parse 'combatantinfo' event
	combatantInfo(wclEvent) {	
		let targetId = wclEvent.sourceID; // aura's target is combatantinfo source
		
		// handle prehots
		// for(let aura of wclEvent.auras) {
		// 	let spellId = aura.ability;
		// 	let sourceId = aura.source; // aura's source is tracked here
		// 	// if player put a prehot on target...
		// 	if(sourceId == this.playerId && this.hots.has(spellId)) {
		// 		this.addSetIfAbsent(targetId);
		// 		this.hotsOnTarget.get(targetId).add(spellId);
		// 		console.log("Player ID " + targetId + " prehotted with " + this.hots.get(spellId));
		// 	}
		// }
	}
	
	// // parse 'apply buff' event
	// applyBuff(wclEvent) {
	// 	let targetId = wclEvent.targetID;
	// 	let spellId = wclEvent.ability.guid;
		
	// 	if(this.hots.has(spellId)) {
	// 		this.addSetIfAbsent(targetId);
	// 		this.hotsOnTarget.get(targetId).add(spellId);
	// 	} else {
	// 		// remove mastery buff from self
	// 		if(this.masteryBuffs.has(spellId)) {
	// 			this.masteryBuffsActive.set(spellId, this.masteryBuffs.get(spellId));
	// 		}
	// 	}
	// }
	
	// // parse 'remove buff' event
	// removeBuff(wclEvent) {
	// 	let targetId = wclEvent.targetID;
	// 	let spellId = wclEvent.ability.guid;
		
	// 	// remove hot from target
	// 	if(this.hots.has(spellId)) {
	// 		this.addSetIfAbsent(targetId);
	// 		this.hotsOnTarget.get(targetId).delete(spellId);
	// 	} else {
	// 		// remove mastery buff from self
	// 		if(this.masteryBuffs.has(spellId)) {
	// 			this.masteryBuffsActive.delete(spellId);
	// 		}
	// 	}
	// }
	
	// parse 'heal' event
	heal(wclEvent) {
		let targetId = wclEvent.targetID;
		let spellId = wclEvent.ability.guid;

		let masteryFactor = wclEvent.
		
		let maxHealth = wclEvent.maxHitPoints;
		let amount = wclEvent.amount; // doesn't include overheal
		let afterHealHealth = wclEvent.hitPoints;
		let beforeHealHealth = afterHealHealth - amount;

		let masteryMultiplier = (beforeHealHealth / maxHealth) * masteryFactor;
		if(wclEvent.absorbed !== undefined) { // absorbed healing is effective healing
			amount+= wclEvent.absorbed;
		}
		
		this.totalHealing += amount;
		
		if(this.hotHealingMap.has(spellId)) {
			this.hotHealingMap.get(spellId).direct += amount;
		}
		
		this.addSetIfAbsent(targetId);
		if(this.druidHeals.has(spellId)) { // spell was boosted by mastery
			let hotsOn = this.hotsOnTarget.get(targetId);
			let numHotsOn = hotsOn.size;
			let healWoMastery = this.getNoMasteryHealing(amount, numHotsOn);
			this.totalNoMasteryHealing += healWoMastery;
			this.shamanSpellNoMasteryHealing += healWoMastery;
			this.masteryTimesHealing += healWoMastery * numHotsOn;
			
			// give each spell credit for mastery boosting
			for(let hotOn of hotsOn) {
				if(hotOn != spellId) { // prevents double count
					this.hotHealingMap.get(hotOn).mastery +=
							this.getOneStackMasteryHealing(amount, numHotsOn);
				}
			}
			
			// attribute healing to mastery buffs that are present
			for(let[buffId, buffObj] of this.masteryBuffsActive.entries()) {
				let attributableHealing = this.getBuffMasteryHealing(
						amount, numHotsOn, buffObj.amount);
				this.masteryBuffAccum.get(buffId).attributableHealing += attributableHealing;
			}
			
		} else { // spell not boosted by mastery
			this.totalNoMasteryHealing += amount;
		}
		
		
	}
	
	// parse 'absorbed' event
	absorbed(wclEvent) {
		// absorbs don't interact with mastery, but they do count towards total healing
		this.totalHealing += wclEvent.amount;
		this.totalNoMasteryHealing += wclEvent.amount;
	}
	
	getResult() {
		let res = $('<div>', {"class":"panel panel-default"});
		
		let playerNameElement = $('<div>', {"class":"panel-heading"})
				.html(toColorHtml("<b>" + this.playerName + " 🍂</br>", this.shamanBlueColor))
				.appendTo(res);
		
		let spellListElement = $('<ul>', {"class":"list-group"})
				.appendTo(res);
				
		// add report for avg HoT stacks
		let avgTotalMasteryHealing =
				roundTo(this.totalHealing - this.totalNoMasteryHealing, 2);
		let percentageMasteryHealing = 
				roundTo(avgTotalMasteryHealing/this.totalHealing, 2);
		$('<li>', {"class":"list-group-item small"})
				.html("<p><b>Average Mastery Healing</b></p>" +
						"&emsp;Raw Healing Due to Mastery: <b>" + avgTotalMasteryHealing + "</b><br>" +
						"&emsp;Mastery Healing as % of Total Healing: <b>" + percentageMasteryHealing + "</b><br>")
				.appendTo(spellListElement);
		
		// add report for each HoT
		let hotText = "<p><b>HoT Mastery Contributions</b></p>";
		for(let [hotId, hotHealingObj] of this.hotHealingMap.entries()) {
			if(hotHealingObj.direct == 0) {
				console.log("No healing from hot ID " + hotId);
				continue; // don't include result entry for HoT you never used
			}
			
			let directPercent = roundTo(hotHealingObj.direct / this.totalHealing * 100, 1);
			let masteryPercent = roundTo(hotHealingObj.mastery / this.totalHealing * 100, 1);		
			hotText += "<p>&emsp;" + getSpellLinkHtml(hotId, this.hots.get(hotId)) +
					'<br>&emsp;&emsp;Direct: <b>' + directPercent + "%</b> " +
					toColorHtml("(" + hotHealingObj.direct.toLocaleString() + ")", this.darkGrayColor) +
					'<br>&emsp;&emsp;Mastery: <b>' + masteryPercent + "%</b> " +
					toColorHtml("(" + hotHealingObj.mastery.toLocaleString() + ")", this.darkGrayColor) +
					"</p>";
		}
		$('<li>', {"class":"list-group-item small"})
				.html(hotText)
				.appendTo(spellListElement);
		
		// add report for each buff
		let hasProc = false;
		let procText = "<p><b>Mastery Procs</b></p>";
		for(let [buffId, buffObj] of this.masteryBuffAccum.entries()) {
			if(buffObj.attributableHealing == 0) {
				console.log("No healing from buff ID " + buffId);
				continue; // don't include result entry for buff that never procced / gave bonus
			}
			hasProc = true;
			
			let amountPercent = roundTo(buffObj.attributableHealing / this.totalHealing * 100, 1);
			procText += "&emsp;" + getSpellLinkHtml(buffId, buffObj.name) + ": <b>" + amountPercent + "%</b> " +
					toColorHtml("(" + buffObj.attributableHealing.toLocaleString() + ")", this.darkGrayColor) +
					"<br>";
		} 
		if(hasProc) {
			$('<li>', {"class":"list-group-item small"})
				.html(procText)
				.appendTo(spellListElement);
		}
		
		// report raw total healing done
		$('<li>', {"class":"list-group-item small"})
				.html(toColorHtml("Total Healing: " + this.totalHealing.toLocaleString(), this.darkGrayColor))
				.appendTo(spellListElement);
		
		return res;
	}
	
	// helper for hotsOnTarget adds new set to mapping value if not there for target
	addSetIfAbsent(targetId) {
		if(!this.hotsOnTarget.has(targetId)) {
			this.hotsOnTarget.set(targetId, new Set());
		}
	}
	
	// gets the amount of healing that can be attributed to *each* mastery stack
	getOneStackMasteryHealing(healAmount, hotCount) {
		let masteryBonus = this.getCurrMastery();
		let healMasteryMultiply = 1 + (hotCount * masteryBonus);
		return Math.round(healAmount / (healMasteryMultiply / masteryBonus));
	}
	
	// the amount of healing that would have been done without mastery
	getNoMasteryHealing(healAmount, hotCount) {
		let masteryBonus = this.getCurrMastery();
		let healMasteryMultiply = 1 + (hotCount * masteryBonus);
		return Math.round(healAmount / healMasteryMultiply);
	}
	
	// the amount of healing attributable to a mastery buff
	getBuffMasteryHealing(healAmount, hotCount, buffAmount) {
		let noMasteryHeal = this.getNoMasteryHealing(healAmount, hotCount);
		let masteryBonusFromBuff = (buffAmount / this.masteryRatingPerOne) / 100;
		return Math.round(noMasteryHeal * masteryBonusFromBuff * hotCount);
	}
	
	// uses curr mastery rating (including buffs), and calcs mastery % from it
	getCurrMastery() {
		let currMasteryRating = this.baseMasteryRating;
		for(let masteryBuff of this.masteryBuffsActive.values()) {
			currMasteryRating += masteryBuff.amount;
		}
		
		return this.masteryRatingToBonus(currMasteryRating);
	}
	
	// gets bonus multiplier per stack from mastery rating
	masteryRatingToBonus(rating) {
		return (this.baseMasteryPercent + (rating / this.masteryRatingPerOne)) / 100;
	}
	
}

