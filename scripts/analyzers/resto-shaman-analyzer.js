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
		
		this.shamanBlueColor = '2359ff';
		this.darkGrayColor = '888888';

		// missing = healing rain, riptide, ancestral guidance?, restorative mists?, unleash life, wellspring,
		
		// these are the spells that can be boosted by Mastery
		this.shamanHeals = new Map();
		this.shamanHeals.set(1064, "Chain Heal");
		this.shamanHeals.set(61295, "Riptide");
		this.shamanHeals.set(209069, "Tidal Totem"); // todo maybe combine this with riptide?
		this.shamanHeals.set(52042, "Healing Stream Totem");
		this.shamanHeals.set(207360, "Queen's Decree");
		this.shamanHeals.set(77472, "Healing Wave");
		this.shamanHeals.set(114942, "Healing Tide Totem");
		this.shamanHeals.set(8004, "Healing Surge");
		this.shamanHeals.set(114911, "Ancestral Guidance"); // not sure if this actually is buffed by mastery
		this.shamanHeals.set(73921, "Healing Rain");
		this.shamanHeals.set(207778, "Gift of the Queen");
		this.shamanHeals.set(157503, "Cloudburst");
		this.shamanHeals.set(114083, "Restorative Mists"); // not sure if thie actually is buffed
		this.shamanHeals.set(73685, "Unleash Life");
		this.shamanHeals.set(197995, "Wellspring"); // could also be 197997
		//this.shamanHeals.set(0, "Ancestral Vigor"); // this is not a spell, but I want to add healing to it manually so I want it 

		//todo calculate value from extra HP from ancestral vigor
		
		this.baseMasteryPercent = 21;
		this.masteryRatingPerOne = 133.33;
		
		this.playerId = this.playerInfo.sourceID;
		this.baseMasteryRating = this.playerInfo.mastery;
		
		this.totalHealing = 0; // total healing from all spells
		this.totalNoMasteryHealing = 0; // total healing before mastery
		this.shamanSpellNoMasteryHealing = 0; // total healing before mastery from spells that benefit from mastery
		
		this.spellHealingMap = new Map(); // map from the spell ID to obj with the direct and mastery healing
		for(let spellId of this.shamanHeals.keys()) {
			this.spellHealingMap.set(spellId, {'direct':0, 'mastery_amount':0, 'num_heals':0, 'health_percentage':0});
			// direct: total amount healed by the spell
			// mastery_amount: amount of healing from mastery
			// num_heals: number of times this spell healed a target
			// health_percentage: this is a running total of all percentages. It will be divided by num_heals later 
			//						to get an average % health of targets healed by this spell
		}
	}
	
	/*
	 * Methodology:
	 * Per friendly target, track their current health. When analyzed spells
	 * heal the friendly target, calculate how much was due to mastery, and add
	 * that to a running total. Be careful to handle overhealing correctly by
	 * only adding the contribution from mastery that did not go into more
	 * overhealing.
	 * 
	 * Want to track the avg % health of targets healed, per spell, weighted by amount healed.
	 * 
	 * Shortcomings:
	 * Does not handle mastery buffs/procs that happen in the middle of the fight.
	 */
	 parse(wclEvent) {
		 
		if(wclEvent.type === 'combatantinfo') {
			this.combatantInfo(wclEvent);
		}
		 
		if(wclEvent.sourceID !== this.playerId) {
			return;
		}
		
		switch( wclEvent.type ) {
			case 'heal' :
				this.heal(wclEvent);
				break;
			case 'absorbed' :
				this.absorbed(wclEvent);
				break;
			default :
		}
	}

	// to calculate the value of mastery we use the following forumulas: 
	// 	base heal + mastery contribution = total heal
	// base heal + base heal * mastery multiplier = total heal
	// base heal + base heal * (mastery % / 100) * (health % / 100) = total heal
	
	// mastery contribution = base heal * (mastery % / 100) * (health % / 100)
	
	// in order to know the mastery contribution, we need to calculate the base heal:
	// base heal + base heal * (mastery % / 100) * (health % / 100) = total heal
	// base heal (1 + (1 * (mastery % / 100) * (health % / 100))) = total heal
	// base heal = total heal / (1 + (1 * (mastery % / 100) * (health % / 100)))
	
	// THEREFORE
	
	// mastery contribution = total heal / (1 + (1 * (mastery % / 100) * (health % / 100))) * (mastery % / 100) * (health % / 100)
	
	// parse 'combatantinfo' event
	combatantInfo(wclEvent) {	
		let targetId = wclEvent.sourceID; // aura's target is combatantinfo source
	}

	getHealHealthPercent(healAmount, maxHealth, currentHealth) {
		let preHealHealth = currentHealth - healAmount;
		return (preHealHealth / maxHealth) * 100;
	}

	// TODO not done.
	getMasteryHealingAmountOverhealAdjusted(healAmount, overhealAmount, maxHealth, currentHealth) {
		let hhp = this.getHealHealthPercent(healAmount, maxHealth, currentHealth);
		let healingAmountFromMastery = hhp * masteryFactor;

		return Math.round(healingAmountFromMastery);
	}

	getBaseHeal(healAmount, maxHealth, currentHealth) {
		let currMasteryPercent = this.getCurrMasteryPercentage();
		let healHealthPercent = this.getHealHealthPercent(healAmount, maxHealth, currentHealth);
		return Math.round(healAmount / (1 + (1 * currMasteryPercent/100) * (healHealthPercent/100)));
	}

	// not used -- not checked for accuracy
	getMasteryHealingPercentage(healAmount, maxHealth, currentHealth) {
		let hhp = this.getHealHealthPercent(healAmount, maxHealth, currentHealth);
		return (this.getCurrMasteryPercentage() * ((100-hhp)/100));
	}

	getMasteryHealingAmount(healAmount, maxHealth, currentHealth) {
		// could also use mastery contribution = total heal / (1 + (1 * (mastery % / 100) * (health % / 100))) * (mastery % / 100) * (health % / 100)
		// but I already made the get base heal function which has the same math, so might as well just subtract from healAmount.
		return Math.round(healAmount - this.getBaseHeal(healAmount, maxHealth, currentHealth));
	}
	
	// parse 'heal' event
	heal(wclEvent) {
		let targetId = wclEvent.targetID;
		let spellId = wclEvent.ability.guid;
		
		let amount = wclEvent.amount;
		let overhealAmount = wclEvent.overheal;
		let maxHP = wclEvent.maxHitPoints;
		let hp = wclEvent.hitPoints;

		let healMasteryAmount = this.getMasteryHealingAmount(amount, maxHP, hp);
		let baseHealAmount = this.getBaseHeal(amount, maxHP, hp);
		let healHealthPercent = this.getHealHealthPercent(amount, maxHP, hp);

		if (wclEvent.absorbed !== undefined) { // absorbed healing is effective healing
			amount+= wclEvent.absorbed;
		}
		
		this.totalHealing += amount;
		
		if (this.spellHealingMap.has(spellId)) {
			this.spellHealingMap.get(spellId).direct += amount;
		}
		
		if (this.shamanHeals.has(spellId)) { // spell was boosted by mastery
			this.spellHealingMap.get(spellId).num_heals++;
			this.spellHealingMap.get(spellId).health_percentage += healHealthPercent; 
			this.spellHealingMap.get(spellId).mastery_amount += healMasteryAmount;
			this.totalNoMasteryHealing += baseHealAmount;

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
				roundTo((avgTotalMasteryHealing/this.totalHealing) * 100, 2);
		$('<li>', {"class":"list-group-item small"})
				.html("<p><b>Average Mastery Healing</b></p>" +
						"&emsp;Raw Healing Due to Mastery: <b>" + avgTotalMasteryHealing.toLocaleString() + "</b><br>" +
						"&emsp;Mastery Healing as % of Total Healing: <b>" + percentageMasteryHealing + "%</b><br>")
				.appendTo(spellListElement);
		
		// add report for each spell
		let spellText = "<p><b>Spell Mastery Contributions</b></p>";
		for(let [spellId, spellHealingObj] of this.spellHealingMap.entries()) {
			if(spellHealingObj.direct == 0) {
				console.log("No healing from spell ID " + spellId);
				continue; // don't include result entry for spell you never used
			} else {
				console.log("Healing from spell ID " + spellId);
			}
			
			let directPercent = roundTo(spellHealingObj.direct / this.totalHealing * 100, 1);
			let masteryPercent = roundTo((spellHealingObj.mastery_amount / this.totalHealing) * 100, 1);
			let avgTargetHealth = roundTo((this.spellHealingMap.get(spellId).health_percentage / this.spellHealingMap.get(spellId).num_heals), 2);		
			spellText += "<p>&emsp;" + getSpellLinkHtml(spellId, this.shamanHeals.get(spellId)) +
					'<br>&emsp;&emsp;Direct: <b>' + directPercent + "%</b> " +
					toColorHtml("(" + spellHealingObj.direct.toLocaleString() + ")", this.darkGrayColor) +
					'<br>&emsp;&emsp;Mastery: <b>' + masteryPercent + "%</b> " +
					toColorHtml("(" + spellHealingObj.mastery_amount.toLocaleString() + ")", this.darkGrayColor) +
					'<br>&emsp;&emsp;Avg Health: <b>' + avgTargetHealth + "%</b> " +
					"</p>";
		}
		$('<li>', {"class":"list-group-item small"})
				.html(spellText)
				.appendTo(spellListElement);
		
		// report raw total healing done
		$('<li>', {"class":"list-group-item small"})
				.html(toColorHtml("Total Healing: " + this.totalHealing.toLocaleString(), this.darkGrayColor))
				.appendTo(spellListElement);
		
		return res;
	}

	// uses curr mastery rating (including buffs), and calcs mastery % from it
	getCurrMasteryPercentage() {
		let currMasteryRating = this.baseMasteryRating;
		
		return this.masteryRatingToBonus(currMasteryRating) * 100;
	}

		// gets bonus multiplier from mastery rating
	masteryRatingToBonus(rating) {
		return (this.baseMasteryPercent + (rating / this.masteryRatingPerOne)) / 100;
	}
	
}

