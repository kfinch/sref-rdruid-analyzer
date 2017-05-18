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
		
		this.baseMasteryPercent = 21; // TODO need to verify
		this.masteryRatingPerOne = 133.33;
		
		this.playerId = this.playerInfo.sourceID;
		
		this.totalHealing = 0; // total healing from all spells
		this.totalNoMasteryHealing = 0; // total healing before mastery
		this.shamanSpellNoMasteryHealing = 0; // total healing before mastery from spells that benefit from mastery
		
		this.spellHealingMap = new Map(); // map from the spell ID to obj with the direct and mastery healing
		for(let spellId of this.shamanHeals.keys()) {
			this.spellHealingMap.set(spellId, {'direct':0, 'mastery':0});
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
	
	// parse 'combatantinfo' event
	combatantInfo(wclEvent) {	
		let targetId = wclEvent.sourceID; // aura's target is combatantinfo source
	}
	
	// parse 'heal' event
	heal(wclEvent) {
		let targetId = wclEvent.targetID;
		let spellId = wclEvent.ability.guid;

		let masteryFactor = this.masteryRatingPerOne;
		
		let maxHealth = wclEvent.maxHitPoints;
		let amount = wclEvent.amount; // doesn't include overheal
		let afterHealHealth = wclEvent.hitPoints;
		let beforeHealHealth = afterHealHealth - amount;

		let masteryMultiplier = (beforeHealHealth / maxHealth) * masteryFactor;

		let masteryHealAmount = masteryMultiplier * amount;
		
		if (wclEvent.absorbed !== undefined) { // absorbed healing is effective healing
			amount+= wclEvent.absorbed;
		}
		
		this.totalHealing += amount;
		
		if (this.spellHealingMap.has(spellId)) {
			this.spellHealingMap.get(spellId).direct += amount;
			
		}
		
		if (this.shamanHeals.has(spellId)) { // spell was boosted by mastery

			this.spellHealingMap.get(spellId).mastery += masteryMultiplier;

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
		
		// add report for each spell
		let spellText = "<p><b>Spell Mastery Contributions</b></p>";
		for(let [spellId, spellHealingObj] of this.spellHealingMap.entries()) {
			if(spellHealingObj.direct == 0) {
				console.log("No healing from spell ID " + spellId);
				continue; // don't include result entry for spell you never used
			}
			
			let directPercent = roundTo(spellHealingObj.direct / this.totalHealing * 100, 1);
			let masteryPercent = roundTo(spellHealingObj.mastery / this.totalHealing * 100, 1);		
			spellText += "<p>&emsp;" + getSpellLinkHtml(spellId, this.shamanHeals.get(spellId)) +
					'<br>&emsp;&emsp;Direct: <b>' + directPercent + "%</b> " +
					toColorHtml("(" + spellHealingObj.direct.toLocaleString() + ")", this.darkGrayColor) +
					'<br>&emsp;&emsp;Mastery: <b>' + masteryPercent + "%</b> " +
					toColorHtml("(" + spellHealingObj.mastery.toLocaleString() + ")", this.darkGrayColor) +
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
	
}

