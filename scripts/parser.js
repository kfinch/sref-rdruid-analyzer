class ParseWorker {
	
	constructor(queryer, reportCode, playerNameMapping, enemyNameMapping,
			fightInfo, outputDiv) {
				
		this.queryer = queryer
		this.reportCode = reportCode;
		this.playerNameMapping = playerNameMapping;
		this.enemyNameMapping = enemyNameMapping;	
		this.fightInfo = fightInfo;
		this.outputDiv = outputDiv;
		
		this.combatantInfos = [];
		this.analyzers = [];
		this.playerQueries = [];
		
		this.progressBarDiv;
		this.progressIntervalId;
	}
	
	// (1) entry point
	run() {
		let startTime = this.fightInfo.start_time;
		
		// query just the first second of encounter to get combatantinfos
		let startPlusOne = startTime + 1000; // milliseconds
		let combatantInfoQuery = new QuerySpec(this.reportCode, startTime, startPlusOne);
		let combatantInfoPromise = this.queryer.executeQuery(
				combatantInfoQuery,
				(wclEvent) => this.addCombatantInfo(wclEvent));
		combatantInfoPromise.then(
				() => this.buildAndRunAnalyzers(),
				() => this.queryError());
	}
	
	// helper for populating combatantInfos array
	addCombatantInfo(wclEvent) {
		if(wclEvent.type == 'combatantinfo') {
			this.combatantInfos.push(wclEvent);
		}
	}
	
	
	// (2) called after combatantInfos have been populated
	buildAndRunAnalyzers() {
		for(let combatantInfo of this.combatantInfos) {
			let playerName = this.playerNameMapping.get(combatantInfo.sourceID);
			
			// each spec has a semi arbitrary ID
			// see: http://wowwiki.wikia.com/wiki/SpecializationID
			if( combatantInfo.specID == 105 ) {
				console.log(playerName + " - Resto Druid");
				console.log(combatantInfo);
				this.analyzers.push(new RestoDruidSubAnalyzer(
						playerName, combatantInfo, this.fightInfo, this.enemyNameMapping));

			} else if( combatantInfo.specID == 103 ) { 
				console.log(playerName + " - Feral Druid");
				console.log(combatantInfo);
				this.analyzers.push(new FeralDruidSubAnalyzer(
						playerName, combatantInfo, this.fightInfo, this.enemyNameMapping));
						
			} else {
				// no analysis for you
			}
			// add more analyzers here
		}
		
		let analysisPromises = [];
		let startTime = this.fightInfo.start_time;
		let endTime = this.fightInfo.end_time;
		for(let analyzer of this.analyzers) {
			for(let combatantInfo of this.combatantInfos) {
				// lets analyzer get all player's info for better handle on start state
				analyzer.parse(combatantInfo);
			}
			
			let playerQuery = new QuerySpec(this.reportCode, startTime, endTime, analyzer.playerId);
			this.playerQueries.push(playerQuery);
			let playerPromise = this.queryer.executeQuery(
					playerQuery,
					(wclEvent) => analyzer.parse(wclEvent));
					
			analysisPromises.push(playerPromise);
		}
		
		// start progress checker, add progress bar
		this.progressBarDiv = $('<div>', {id:"progress-container", "class":"progress"})
				.appendTo(this.outputDiv);
		$('<div>', {id:"progress-bar", "class":"progress-bar progress-bar-striped", "role":"progressbar",
				"aria-valuenow":"0", "aria-valuemin":"0", "aria-valuemax":"100", "style":"width: 0%"})
				.appendTo(this.progressBarDiv);
				
		this.progressIntervalId = setInterval(() => this.updateProgressBar(), 200);
		
		// wait for all analyzers to be done before populating results
		Promise.all(analysisPromises).then(
				() => this.analysisDone(),
				() => this.queryError());
	}
	
	// (4) called after analyzers have been fed data
	analysisDone() {
		console.log("analysis done!");
		
		// stop progress checker and remove progress bar
		clearInterval(this.progressIntervalId);
		this.progressBarDiv.remove();
		
		// add header with fight title
		let analysisTitleDiv = $('<div>', {"class":"panel panel-default"})
				.appendTo(this.outputDiv);
		let analysisTitleHeader = $('<div>', {"class":"panel-heading text-center"})
				.html("<b>" + formatFight(this.fightInfo) + "</b>")
				.appendTo(analysisTitleDiv);
		
		// add responsive columns to place analyzer results in
		let analysisRowDiv = $('<div>', {"class":"row"})
				.appendTo(this.outputDiv);
		let analysisLeftColDiv = $('<div>', {"class":"col-sm-6"})
				.appendTo(analysisRowDiv);
		let analysisRightColDiv = $('<div>', {"class":"col-sm-6"})
				.appendTo(analysisRowDiv);
		
		// get results from analyzers and append them to columns
		for(let i=0; i<this.analyzers.length; i++) {
			let analysisResult = this.analyzers[i].getResult();
			if(i%2 == 0) {
				analysisResult.appendTo(analysisLeftColDiv);
			} else {
				analysisResult.appendTo(analysisRightColDiv);
			}
		}
	}
	
	/**
	 * Called on query error
	 */
	queryError(errorJson) {
		// TODO
	}
	
	updateProgressBar() {
		let queryCount = this.playerQueries.length;
		let totalProg = 0;
		for(let qSpec of this.playerQueries) {
			totalProg += qSpec.getProgress();
		}
		let currPercent = totalProg / queryCount * 100;
		
		console.log("Updating progress bar: queries=" + queryCount +
				" totalProg=" + totalProg + " currPercent=" + currPercent);

		$("#progress-bar").attr("aria-valuenow", currPercent).attr("style", "width: " + currPercent + "%");
	}
}

/**
 * Encapsulates building analyzers list, sending query to WCL,
 * and passing events through to the analyzers.
 */
class ReportParser {
	
	/**
	 * apiKey - api key to use with query
	 * reportCode - report code to use with query
	 * playerNameMapping - mapping from player IDs to namespaceURI
	 * enemyNameMapping - mapping from enemy IDs to names
	 *		different enemies with same name will have same ID, but different instanceID.
	 */
	constructor(apiKey, reportCode, playerNameMapping, enemyNameMapping) {
		this.eventQueryer = new EventQueryFactory(apiKey);
		this.reportCode = reportCode;
		this.playerNameMapping = playerNameMapping;
		this.enemyNameMapping = enemyNameMapping;
	}
	
	/**
	 * Builds analyzers for given fight, querys WCL for events,
	 * passes events through to analyzers, and tabulates results in given output div. 
	 *
	 * fightInfo - json obj about fight, used to make query
	 * outputDiv - jquery html obj onto which output should be appended
	 */
	parse(fightInfo, outputDiv) {
		// actual parse encapsulated in its own class because this action requires a lot of callbacks
		// and I wanted to avoid constantly passing the same vars through each method
		let worker = new ParseWorker(this.eventQueryer, this.reportCode,
				this.playerNameMapping, this.enemyNameMapping, fightInfo, outputDiv);
		worker.run();
	}
	
}

// TODO find syntax conflict with export
//export ReportParser;