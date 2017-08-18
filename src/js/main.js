

$(document).ready(function() {
	console.log("document ready!");
	
	// This is my (Sref's) public api key.
	// WCL documentation implies these are inteded for use with webapps, so this should be fine.
	var apiKey = "230d616c242ecbd6e2bfc07c4593d485";
	
	// init initial app elements: input for report code, and button to dispatch query
	$("<div>", {id: "report-div", "class": "form-inline"})
			.appendTo($("#app-container"));
			
	$("<input>", {id: "report-input", "class": "form-control", "placeholder": "Enter Report URL or ID..."})
			.appendTo($("#report-div"));
			
	$("<button>", {id: "report-button", "class": "btn btn-primary"})
			.text("Get")
			.click(getReport)
			.appendTo($("#report-div"));
			
	$('<br>').appendTo($("#app-container"));
	
	/**
	 * Called when the 'Get' button is pressed for a report
	 */
	function getReport() {
		console.log("report button pressed");
		
		// remove previous fights div
		$("#fights-div").remove();
		
		// make new fights div for generate content
		var fightsDiv = $("<div>", {id: "fights-div", "class": "form-inline"})
				.appendTo($("#app-container"));
		
		// get fights JSON
		var reportCode = parseReportCode($("#report-input").val());
		console.log("reportCode=" + reportCode);
		
		// TODO instead implement the below as input validation?
		if(reportCode == null) {
			console.log( "this doesn't look like a report code" );
			$('<div>', {"class": "alert alert-danger"})
					.text("Input isn't a WCL report")
					.appendTo(fightsDiv);
			return;
		} else {
			// replaces full url with just report code in entry box for clarity
			$("#report-input").val(reportCode);
		}
		
		var url = "https://www.warcraftlogs.com/v1/report/fights/" + reportCode
	  		+ "?api_key=" + apiKey;
		console.log("fetching report json from " + url);
		
		var reportReq = $.getJSON(url)
		.done(function(report) {
			console.log( JSON.stringify(report) );
		
			// add fight select menu
			var fightSelect = $('<select>', {id: "fight-select", "class": "form-control"})
					.data("reportCode", reportCode) // for retrieve at analysis time
					.data("reportData", report)
					.appendTo(fightsDiv);
					
			// add fights
			var includedFights = $(report.fights).filter(function() { return this.boss != 0; });
			if(includedFights.length == 0) {
				console.log("No boss fights, including all fights");
				includedFights = $(report.fights);
			}
			includedFights.each(function() {
				$("<option>")
						.text(formatFight(this))
						.data("fight", this) // attach fight object to option
						.appendTo(fightSelect);
			});
			
			// add analyze button
			$('<button/>', {id: "analyze-button", "class": "btn btn-success"})
					.text("Analyze")
					.click(analyzeFight)
					.appendTo(fightsDiv);
  		})
  		.fail(function(errReport) { // bad report code returns an error message, which we'll pass to the user
    			console.log( "error fetching report json..." );
				console.log( JSON.stringify(errReport) );
				$('<div>', {"class": "alert alert-danger"})
						.text("ERROR: " + errReport.responseJSON.error)
						.appendTo(fightsDiv);
  		});
	}
	
	/*
	 * Detects either a pasted link or just a lone report code,
	 * and returns the report code. If input doesn't look like a report code, returns null.
	 */
	function parseReportCode( input ) {
		var wclUrlRegex = /warcraftlogs\.com\/reports\/([0-9a-zA-Z]*)/;
		var codeAloneRegex = /^([0-9a-zA-Z]+)$/;
		console.log("Matching entered report code vs regex: ");
		
		var wclUrlMatch = wclUrlRegex.exec(input);
		console.log(wclUrlMatch);
		if(wclUrlMatch != null) {
			return wclUrlMatch[1];
		}
		
		var codeAloneMatch = codeAloneRegex.exec(input);
		console.log(codeAloneMatch);
		if(codeAloneMatch != null) {
			return codeAloneMatch[1];
		}
		
		return null;
	}

	/*
	 * Entry function for analysis. Sets up data and then enters callback loop as data is fetched.
	 */
	function analyzeFight() {
		console.log("analyze button pressed");
		
		// remove previous analysis div
		$("#analysis-div").remove();
		
		// make new analysis div for generated content
		var analysisDiv = $("<div>", {id:"analysis-div"})
				.appendTo($("#fights-div"));
		$('<br>').appendTo($("#analysis-div"));
		
		var selectedOption = $("#fight-select :selected").first();
		var fightInfo = selectedOption.data("fight");
		
		// retrieve report code and report data
		var reportCode = $("#fight-select").data("reportCode");
		var reportData = $("#fight-select").data("reportData");
		
		console.log( selectedOption );
		console.log( JSON.stringify(selectedOption.data("fight")) );
		
		// init and run parser
		var parser = new ReportParser(apiKey, reportCode,
				getPlayerNameMapping(reportData), getEnemyNameMapping(reportData));
		parser.parse(fightInfo, analysisDiv);
	}
	
	function getPlayerNameMapping( reportData ) {
		var playerNameMapping = new Map();
		
		for( friendly of reportData.friendlies ) {
			playerNameMapping.set(friendly.id, friendly.name);
		}
		
		console.log(playerNameMapping);
		return playerNameMapping;
	} 
	
	function getEnemyNameMapping( reportData ) {
		var enemyNameMapping = new Map();
		
		for( enemy of reportData.enemies ) {
			enemyNameMapping.set(enemy.id, enemy.name);
		}
		
		console.log(enemyNameMapping);
		return enemyNameMapping;
	}

});
