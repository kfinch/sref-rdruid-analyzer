
/*
 * Given a duration in millis, returns a formatted string of that time in minutes and seconds.
 */
function formatTime( timeInMillis ) {
	var totalSeconds = Math.floor(timeInMillis / 1000);
	
	var minutes = Math.floor(totalSeconds / 60);
	var seconds = totalSeconds - (minutes*60);
	
	var result = "" + minutes + ":";
	if(seconds < 10) {
		result += "0";
	}
	result += seconds;
	return result;
}

/*
 * Returns num rounded to given number of decimal places.
 * If you want to round to whole number, faster to use Math.round()...
 */
function roundTo( num, places ) {
	var mult = Math.pow(10, places);
	return Math.round(num * mult) / mult;
}

/*
 * Given html, wraps it in font tag to turn it given color
 */
function toColorHtml( html, hexColor) {
	return '<font color="#' + hexColor + '">' +
			html + '</font>';
}

/*
 * Given a WoW spell's ID and name, builds a wowhead link to it
 */
function getSpellLinkHtml( spellId, spellName) {
	return '<a href="http://www.wowhead.com/spell=' + spellId + '">' + spellName + '</a>';
}

/*
 * Given a fight object from a report, builds a user facing string for the fight
 */
function formatFight( fight ) { // expects 'fight' structure from array in report JSON
	console.log( JSON.stringify(fight) );
	stringResult = fight.name + " " + getDifficulty(fight) +
			" (" + formatTime(fight.end_time - fight.start_time) + ")";
	if (fight.boss == 0) {
		console.log(stringResult);
		return stringResult;
	}
	
	if( fight.kill ) {
		stringResult += " (KILL)";
	} else {
		var percent = Math.floor(fight.bossPercentage / 100);
		stringResult += " (WIPE @ " + percent + "%)";
	}
	console.log(stringResult);
	return stringResult;
}

/*
 * Gets fight difficulty string given difficulty code from JSON
 */
function getDifficulty( fight ) {
	switch(fight.difficulty) {
		case 1:
			return "LFR";
			break;
		case 3:
			return "Normal";
			break;
		case 4:
			return "Heroic";
			break;
		case 5:
			return "Mythic";
			break;
		default:
			return "";
			break;
	}
}