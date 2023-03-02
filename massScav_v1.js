javascript:

// if (typeof DEBUG !== 'boolean') DEBUG = false;
if (typeof DEBUG !== 'boolean') DEBUG = true;

var starting = Date.now();
var scriptName = 'Optimal Mass Scavenging -  ';
var unitsHaulCapacity = [25, 15, 10, 10, 80, 50, 50];
var unitPop = [1, 1, 1, 1, 4, 5, 6];
var lootFactor = [0.1, 0.25, 0.5, 0.75];
var pauseTime = 300;
var archerWorld = false;
var imageList = [];
var imageStrings = [];

function runMassScavenge() {
	var baseURL;
	if (game_data.player.sitter > 0) {
		baseURL = `game.php?t=${game_data.player.id}&screen=place&mode=scavenge_mass`;
	} else {
		baseURL = 'game.php?&screen=place&mode=scavenge_mass';
	}
	let URLs = [];
	jQuery
		.get(baseURL)
		.done(() => {
			let amountOfPages = jQuery(this).find('.paged-nav-item').length;
			for (var i = 0; i <= amountOfPages; i++) {
				URLs.push(baseURL + '&page=' + i);
			}
			var dataArray = '[';
			var worldDataArray = '[';
			if (DEBUG) {
				console.debug(`${scriptName} URLs :`, URLs);
			}
			jQuery.getAll(
				URLs,
				(_, data) => {
					worldData = jQuery(data)
						.find('script:contains("ScavengeMassScreen")')
						.html()
						.match(/\{.*\:\{.*\:.*\}\}/g)[0];
					worldDataArray += worldData + ',';

					rawData = jQuery(data)
						.find('script:contains("ScavengeMassScreen")')
						.html()
						.match(/\{.*\:\{.*\:.*\}\}/g)[2];
					dataArray += rawData + ',';
				},
				() => {
					dataArray = dataArray.substring(0, dataArray.length - 1);
					dataArray += ']';

					worldDataArray = worldDataArray .substring(0, worldDataArray.length - 1);
					worldDataArray += ']';

					const scavengingInfo = JSON.parse(dataArray);
					const worldInfo = JSON.parse(worldDataArray);
					const infoTable = [];

					let tableLength = scavengingInfo.length;
					for (var i = 0; i < tableLength; i++) {
						const { village_id, village_name, options, unit_counts_home } = scavengingInfo[i];
						const tempOptions = [];
						const validOptions = [];
						const unitCounts = [];
						let anyAvailable = 0;
						for (let [_, value] of Object.entries(options)) {
							if ((value.scavenging_squad === null) && (value.is_locked === false)) {
								anyAvailable = 1;
								validOptions.push(value.base_id);
							}
						}
						if (anyAvailable == 1) {
							infoTable.push({
								village_id: village_id,
								village_name: village_name,
								option_id: validOptions,
								unit_counts: unit_counts_home
							});
						}

					}

					if (infoTable.length == 0) {
						UI.ErrorMessage('Scavenging not possible right now');
					}
					const durationFactor = worldInfo[0][1]["duration_factor"];
					const durationExponent = worldInfo[0][1]["duration_exponent"];

					var htmlString = buildUI();
					let settings = getSettings();
					if (DEBUG) {
						console.debug(`${scriptName} Settings: `, settings);
					}

					let requests = calculateOptimalSquads(settings, infoTable, amountOfPages, durationFactor, durationExponent);

					if (DEBUG) {
						console.debug(`${scriptName} Requests :`, requests);
					}

					let noOfGroups = Object.keys(requests).length;

					if (noOfGroups == 0) {
						UI.ErrorMessage('No avaiable options');
					}

					let noOfSquads = 0;
					let requestVillages = [];
					let noOfUnits = [0,0,0,0,0,0,0];

					for (var u = 0; u < noOfGroups; u++) {
						let request = requests[u];
						for (let [_, value] of Object.entries(request)) {
							if (requestVillages.includes(value['village_id']) == false) {
								requestVillages.push(value['village_id']);
							}
							noOfUnits[0] += value['candidate_squad']['unit_counts']['spear'];
							noOfUnits[1] += value['candidate_squad']['unit_counts']['sword'];
							noOfUnits[2] += value['candidate_squad']['unit_counts']['axe'];
							noOfUnits[4] += value['candidate_squad']['unit_counts']['light'];
							noOfUnits[6] += value['candidate_squad']['unit_counts']['heavy'];
							if (archerWorld) {
								noOfUnits[3] += value['candidate_squad']['unit_counts']['archer'];
								noOfUnits[5] += value['candidate_squad']['unit_counts']['marcher'];
							}
						}
						noOfSquads += Object.keys(request).length;
					}

					let noOfVillages = requestVillages.length;

					if (imageStrings === undefined || imageStrings .length == 0) {
						for (var m = 0; m < 9; m++) {
							imageStrings.push('<img src=' + imageList[m] + '> ')
						}
					}
					let unitStrings = [];

					for (var p = 0; p < 9; p++) {
						if (p < 7) {
							unitStrings.push("");
							if (noOfUnits[p] > 0) {
								unitStrings[p] += imageStrings[p];
								unitStrings[p] += noOfUnits[p];
								unitStrings[p] += "  ";
							}
						}
						else {
							imageStrings.push('<img src=' + imageList[p] + '>');

						}
					}


					if (noOfGroups > 0) {
						htmlString += `
			<br>
			<div class="ra-output">
				<h3 class="ra-info-text">
					${'Groups: '} ${noOfGroups}  &nbsp; ${'Villages: '} ${noOfVillages} &nbsp; ${'Squads: '} ${noOfSquads}
				</h3>
			<table class="ra-table" align="center" width="100%">
				<tbody>
					<tr>
						<td class="ra-unit-counts" width="70%">
							<h4>
								<pre>${unitStrings[0]}${unitStrings[1]}${unitStrings[2]}${unitStrings[3]}</pre>
								<pre>${unitStrings[4]}${unitStrings[5]}${unitStrings[6]}</pre>
							</h4>
						</td>
						<td class="ra-text-center">
							<a href="#" class="btn btn-confirm-yes btn-mass-scav" group-id="1"> ${'Send squads '}</a>
				</td>
			</tr>
				</tbody>
			</table>
			</div>
					`;
					}

					var content = `
							${htmlString}
					`;

					renderUI(content);

					let checkboxValues = settings['unit_options'];
					if (checkboxValues['spear'] == true) {
						$('.zSpear').prop('checked', true);
					}
					if (checkboxValues['sword'] == true) {
						$('.zSword').prop('checked', true);
					}
					if (checkboxValues['axe'] == true) {
						$('.zAxe').prop('checked', true);
					}
					if (checkboxValues['archer'] == true) {
						$('.zArcher').prop('checked', true);
					}
					if (checkboxValues['light'] == true) {
						$('.zLight').prop('checked', true);
					}
					if (checkboxValues['marcher'] == true) {
						$('.zMarcher').prop('checked', true);
					}
					if (checkboxValues['heavy'] == true) {
						$('.zHeavy').prop('checked', true);
					}

					$('.zHours').val(settings['max_away_time']);

					jQuery('#recalculate').on('click', function (e) {
						e.preventDefault();
						jQuery('.ra-output').remove();
						if (DEBUG) {
							console.debug(`${scriptName} Recalculating squads`);
						}
						getNewSettings();
						runMassScavenge();
					});
					sendSquadGroups(requests);
					if (DEBUG) {
						let timeBeforeReady = Date.now();
						let elapsedMilliseconds = timeBeforeReady - starting;
						console.debug(`${scriptName} Elapsed time (ms) before button can be pressed: `, elapsedMilliseconds);
					}

				},
				(error) => {
					console.error(error);
				}
			);
		});
}

$.getAll = function (pages, getData, finished, error) {
	let numDone = 0;
	let startTime = 0;
	let newTime;
	nextPage();
	function nextPage() {
		if (numDone == pages.length) {
			finished();
			return;
		}
		newTime = Date.now();
		let elapsed = newTime - startTime ;
		if (elapsed < pauseTime) {
			let timeLeft = pauseTime - elapsed;
			setTimeout(nextPage, timeLeft);
			return;
		}
		startTime = newTime;
		$.get(pages[numDone]).done((data) => {
				try {
					getData(numDone, data);
					numDone++;
					nextPage();
				} catch (e) {
					error(e);
				}
			})
			.fail((xhr) => {
				error(xhr);
			});
	}
};

function buildUI() {
	if (DEBUG) {
		console.debug(`${scriptName} Building UI`);
	}
	let html = "";

	if (archerWorld) {
		html +=
		'<table align="center" class="zscavengeTable" width="100%" style="border: 2px solid rgba(121,0,0,0.5);">\
			<tbody>\
				<tr>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="spear"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_spear.png" title="Spear fighter" alt="" class=""></a></th>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="sword"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_sword.png" title="Swordsman" alt="" class=""></a></th>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="axe"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_axe.png" title="Axeman" alt="" class=""></a></th>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="archer"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_archer.png" title="Archer" alt="" class=""></a></th>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="light"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_light.png" title="Light cavalry" alt="" class=""></a></th>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="marcher"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_marcher.png" title="Mounted Archer" alt="" class=""></a></th>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="heavy"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_heavy.png" title="Heavy cavalry" alt="" class=""></a></th>\
					<th style="text-align:center">Max away time</th>\
					<th style="text-align:center">Apply new settings</th>\
				</tr>\
				<tr>\
					<td align="center"><input type="checkbox" ID="zSpear" class="zSpear" name="spear" ></td>\
					<td align="center"><input type="checkbox" ID="zSword" class="zSword" name="sword" ></td>\
					<td align="center"><input type="checkbox" ID="zAxe" class="zAxe" name="axe" ></td>\
					<td align="center"><input type="checkbox" ID="zArcher" class="zArcher" name="archer" ></td>\
					<td align="center"><input type="checkbox" ID="zLight" class="zLight" name="light" ></td>\
					<td align="center"><input type="checkbox" ID="zMarcher" class="zMarcher" name="marcher" ></td>\
					<td align="center"><input type="checkbox" ID="zHeavy" class="zHeavy" name="heavy" ></td>\
					<td ID="runtime" align="center"><input type="text" ID="zHours" class="zHours" name="hours" size="3" maxlength="3" align=left > hours</td>\
					<td ID="recalculate-btn" align="center">\
					<a href="javascript" class="btn" id="recalculate">Recalculate</a>\
					</td>\
			</tbody>\
		</table>\
		</br>\
		';
	} else {
		html +=
		'<table align="center" class="zscavengeTable" width="100%" style="border: 2px solid rgba(121,0,0,0.5);">\
			<tbody>\
				<tr>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="spear"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_spear.png" title="Spear fighter" alt="" class=""></a></th>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="sword"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_sword.png" title="Swordsman" alt="" class=""></a></th>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="axe"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_axe.png" title="Axeman" alt="" class=""></a></th>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="light"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_light.png" title="Light cavalry" alt="" class=""></a></th>\
					<th style="text-align:center"><a href="#" class="unit_link" data-unit="heavy"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_heavy.png" title="Heavy cavalry" alt="" class=""></a></th>\
					<th style="text-align:center">Max away time</th>\
					<th style="text-align:center">Apply new settings</th>\
				</tr>\
				<tr>\
					<td align="center"><input type="checkbox" ID="zSpear" class="zSpear" name="spear" ></td>\
					<td align="center"><input type="checkbox" ID="zSword" class="zSword" name="sword" ></td>\
					<td align="center"><input type="checkbox" ID="zAxe" class="zAxe" name="axe" ></td>\
					<td align="center"><input type="checkbox" ID="zLight" class="zLight" name="light" ></td>\
					<td align="center"><input type="checkbox" ID="zHeavy" class="zHeavy" name="heavy" ></td>\
					<td ID="runtime" align="center"><input type="text" ID="zHours" class="zHours" name="hours" size="3" maxlength="3" align=left > hours</td>\
					<td ID="recalculate-btn" align="center">\
					<a href="javascript" class="btn" id="recalculate">Recalculate</a>\
					</td>\
			</tbody>\
		</table>\
        </div>\
';
	}
	return html;
}

function renderUI(body) {
	if (DEBUG) {
		console.debug(`${scriptName} Rendering UI`);
	}
	const uiContent = `
<div class="ra-mass-scav" id="raMassScav" style="border: 10px solid rgba(121,0,0,1); border-image-slice: 7 7 7 7; border-image-source: url(https://dsen.innogamescdn.com/asset/cf2959e7/graphic/border/frame-gold-red.png);">
	<span position="relative">
		<img src="https://dsen.innogamescdn.com/asset/59fb2ca0/graphic/awards/award2.png">
		<h1 class="ra-title">${'Optimal Mass Scavenging'} </h1>
		<a class="popup_box_close custom-close-button" onClick="closeDraggableEl();" href="#">&nbsp;</a>
	<span>
	<div class="ra-mass-scav-settings">
		${body}
	</div>
</div>
	<style>
		.ra-mass-scav { position: fixed; z-index: 99999; top: 10vh; right: 10vw; display: block; width: 400px; height: auto; clear: both;
		margin: 0 auto 15px; padding: 12px; border: 1px solid #603000; box-sizing: border-box;
		background-image: url(https://dsen.innogamescdn.com/asset/59fb2ca0/graphic/background/bg-image.jpg); opacity: 95%;
		background-repeat: no-repeat; background-position:bottom; }
		.ra-mass-scav * { box-sizing: border-box; }
		.custom-close-button { right: 0; top: 0; }
		.ra-table { border-spacing: 0px;}
		.ra-table th { }
		.ra-table td a { word-break: break-all; }
		.ra-text-left { text-align: left !important; }
		.ra-text-center { text-align: center; }
		.ra-info-text { font-size: 1.3em; text-align:center; padding: 0px; font-family: Arial, Helvetica, sans-serif; margin-bottom: 0px; margin-top: 5px;}
		.ra-title { font-size: 2.1em; margin-left: 55px; padding: 1px; font-family: "Times New Roman", Times, serif; position: absolute; top: 6px; }
		.ra-unit-counts { text-align: center; line-height: 0.5em; }
		.ra-mass-scav-settings { margin-top: 8px; }
		.zscavengeTable { background: rgba(244, 228, 188, 1); }
		.btn-confirm-yes:hover { background: rgba(255,0,0,1); color: #050505; box-shadow: inset 0 0 0 3px #000000; }
}

	</style>
`;

	if (jQuery('#raMassScav').length < 1) {
		jQuery('body').append(uiContent);
		jQuery('#raMassScav').draggable();
	} else {
		jQuery('.ra-mass-scav-settings').html(body);
	}
}

function calculateOptimalSquads(settings, infoTable, pageCount, durationFactor, durationExponent) {
	if (DEBUG) {
		console.debug(`${scriptName} Finding optimal distributions`);
	}
	let requestLists = [];
	let scavengeTables = [];
	if (pageCount == 0) {
		scavengeTables.push(infoTable);
	}
	else {
		let pageIndex = 0;
		for (var page = 0; page <= pageCount; page++) {
			let slicedTable = [];
			for (var i = pageIndex*50; i < infoTable.length; i++) {
				pageIndex++;
				slicedTable.push(infoTable[i]);
			}
			scavengeTables.push(slicedTable);
	}
	}
	let requestList = [];
	for (var page = 0; page <= pageCount; page++) {
		let correctedDistributions = [];
		for (var i = 0; i < scavengeTables[page].length; i++) {
			let correctedDistribution = [];
			let initialized = initInitialDistribution(settings["unit_options"], scavengeTables[page][i].unit_counts);
			let initialDistribution = initialized[0];
			let remaining = initialized[1];
			const options = [];
			for (var k = 1; k < 5; k++) {
				if (scavengeTables[page][i].option_id.includes(k)) {
					options.push(true);
				}
				else {
					options.push(false);
				}
			}
			const allocated = allocateUnits(settings["max_away_time"], initialDistribution, remaining, options, durationFactor, durationExponent);
			let pop = calculatePop(allocated[0])
			let reallocate = []
			for (var option = 0; option < 4; option++) {
				if (pop[option] != 0 && pop[option] < 10) {
					reallocate.push(allocated[0][option]);
					allocated[0][option] = [0,0,0,0,0,0,0];
					options[option] = false;
				}
				else {
					reallocate.push([0,0,0,0,0,0,0]);
				}
			}
			let sumReallocated = [];
			for (var unit = 0; unit < 7; unit++) {
				let sums = 0;
				for (var option = 0; option < 4; option++) {
					sums += reallocate[option][unit];
				}
				sumReallocated.push(sums);
			}
			if (sumReallocated == [0,0,0,0,0,0,0,0]) {
				correctedDistribution.push(allocated[0]);
			}
			else {
				correctedDistribution.push(allocateUnits(settings["max_away_time"], allocated[0], sumReallocated, options)[0]);
			}
			let villageID = scavengeTables[page][i]["village_id"];
			correctedDistribution.unshift(villageID);
			correctedDistributions.push(correctedDistribution);
		}
		requests = [];

		let cdNo = correctedDistributions.length;
		let requestNum = 0;
		for (var t = 0; t < cdNo; t++) {
			let village = correctedDistributions[t];
			let noOfOptions = village[t].length;
			for (var e = 0; e < noOfOptions; e++) {
				let sum = 0;
				for (unit = 0; unit < 7; unit++) {
					sum += unit;
				}
				if (sum != 0) {
					let request = { "villageId": village[0], "unitCounts": option, "optionId": i};
					requests.push(request);
					requestNum++;
				}
			}
			}
		let squadRequests = {};
		let squadRequestIndex = {};

		for (var d = 0; d < requestNum; d++) {
			let request = requests[d];

			const { villageId, unitCounts, optionId } = request;
			let candidateSquad = {
				'unit_counts': {
					'spear': unitCounts[0],
					'sword': unitCounts[1],
					'axe': unitCounts[2],
					'light': unitCounts[4],
					'heavy': unitCounts[6]
				},
				carry_max: 9999999999
			};
			let squadRequest = {
					'village_id': villageId,
					'candidate_squad': candidateSquad,
					'option_id': optionId+1,
					'use_premium': false,
			};
			squadRequests[d] = squadRequest;
		}
		requestList.push(squadRequests);
	}
	for (var q = 0; q <= pageCount; q++) {
		let pageNum = Object.keys(q).length;
		if (pageNum > 0) {
			requestLists.push(q)
		}
	}
	return requestLists;
}

function sendSquadGroups(requests) {
	jQuery('.btn-mass-scav').on('click', function (e) {
		e.preventDefault();
		jQuery(this).attr('disabled', 'disabled');

		let numberOfRequests = requests.length;
		for (var w = 0; w < numberOfRequests; w++) {
			TribalWars.post(
			'scavenge_api',
			{ ajaxaction: 'send_squads'},
				{squad_requests: request}
			);
			if (DEBUG) {
				console.debug(`${scriptName} Sending Group ${i+1}`);
			}
			setTimeout(() => { }, pauseTime);
		}
		UI.SuccessMessage('Squads sent');
		jQuery('.ra-mass-scav').fadeOut(500);
	});
}

function calculatePop(unit_distribution) {
    let popCounts = [];
	for (var option = 0; option < 4; option++) {
		let pop = 0;
		for (var unit = 0; unit < 7; unit++) {
            pop += unit_distribution[option][unit] * unitPop[unit];
		}
		popCounts.push(pop);
	}
	return popCounts;
}

function initInitialDistribution(settings, units) {
	if (DEBUG) {
		console.debug(`${scriptName} Initializing initial distribution`);
	}
    let distribution = [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
    ]
	let unitsLeftToAllocate = [];

	if (settings["spear"] == false) {
	unitsLeftToAllocate[0] = 0;
	}
	else {
		unitsLeftToAllocate[0] = units["spear"];
	}

	if (settings["sword"] == false) {
		unitsLeftToAllocate[1] = 0;
	}
	else {
		unitsLeftToAllocate[1] = units["sword"];
	}

	if (settings["axe"] == false) {
		unitsLeftToAllocate[2] = 0;
	}
	else {
		unitsLeftToAllocate[2] = units["axe"];
	}

	if (settings["light"] == false) {
		unitsLeftToAllocate[4] = 0;
	}
	else {
		unitsLeftToAllocate[4] = units["light"];
	}

	if (settings["heavy"] == false) {
		unitsLeftToAllocate[5] = 0;
	}
	else {
		unitsLeftToAllocate[5] = units["heavy"];
	}

	if (archerWorld){
		if (settings["archer"] == false) {
			unitsLeftToAllocate[3] = 0;
		}
		else {
			unitsLeftToAllocate[3] = units["archer"];
		}
		if (settings["marcher"] == false) {
			unitsLeftToAllocate[5] = 0;
		}
		else {
			unitsLeftToAllocate[5] = units["marcher"];
		}
	}
	else {
		unitsLeftToAllocate[3] = 0;
		unitsLeftToAllocate[5] = 0;
	}
    return [distribution, unitsLeftToAllocate];
}

function allocateUnits(maxScavHours, unit_distribution, remainingUnits, options, durationFactor, durationExponent) {
	if (options.includes(true)) {
		for (var unit = 0; unit < 7; unit++) {
			let marginal = [0,0,0,0];
			let maxDuration = maxScavHours*3600;
			while (remainingUnits[unit] > 0) {
				var initialRate = calculateTimeAndRate(unit_distribution, durationFactor, durationExponent)[0];
				for (var option = 0; option < 4; option++) {
					unit_distribution[option][unit] += 1;
					let timeAndRate = calculateTimeAndRate(unit_distribution, durationFactor, durationExponent);
					let newRate = timeAndRate[0];
					let newDuration = timeAndRate[1][option];
					unit_distribution[option][unit] -= 1;
					if (newDuration < maxDuration && options[option] == true) {
						marginal[option] = newRate - initialRate;
					}
					else {
						marginal[option] = 0;
					}
				}
				let sum = 0;
				let largestIncrease = 0;
				let max = 0;
				for (var option = 0; option < 4; option++) {
					sum += marginal[option];
					if (marginal[option] > largestIncrease) {
						largestIncrease = marginal[option];
						max = option;
					}
				}
				if (largestIncrease > 0) {
					unit_distribution[max][unit] += 1;
					remainingUnits[unit] -= 1;
				}
				else {
					break;
				}
				}
		}
	}
    return [unit_distribution, remainingUnits];
}

function calculateTimeAndRate(unit_distribution, durationFactor, durationExponent) {
    let rates = [0,0,0,0];
    let times = [0,0,0,0];
    let totalHaulCapacity = [0,0,0,0]; for (var option = 0; option < 4; option++) {
		for (var unit = 0; unit < 7; unit++) {
			let unitHaulCapacity = unitsHaulCapacity[unit]*unit_distribution[option][unit];
			totalHaulCapacity[option] += unitHaulCapacity;
		}
	}
	for (var option = 0; option < 4; option++) {
        let optionCap = totalHaulCapacity[option]*lootFactor[option];
		if (optionCap > 0) {
			times[option] = (Math.pow(10*optionCap, 2*durationExponent) + 1800) * durationFactor;
			rates[option] = optionCap / times[option];
		}
	}
	let totalRate = 0;
	for (var i = 0; i < 4; i++) {
		totalRate += rates[i];
	}
	return [totalRate, times];
}

function closeDraggableEl() {
	jQuery('#raMassScav').remove();
}

function getNewSettings() {
	if (DEBUG) {
		console.debug(`${scriptName} Applying new settings`);
	}
	let maxAwayTime = Number(document.getElementById("zHours").value);

	let validNumber = isNaN(maxAwayTime);
	if (validNumber == false) {
		if (maxAwayTime > 0) {
			localStorage.setItem("zMaxAwayTime", maxAwayTime);
		}
	}

	let unitOptions = "{";

	if (document.getElementById("zSpear").checked == true) {
		unitOptions += '"spear":true';
	}
	else {
		unitOptions += '"spear":false';
	}
	if (document.getElementById("zSword").checked == true) {
		unitOptions += ',"sword":true';
	}
	else {
		unitOptions += ',"sword":false';
	}
	if (document.getElementById("zAxe").checked == true) {
		unitOptions += ',"axe":true';
	}
	else {
		unitOptions += ',"axe":false';
	}
	if (document.getElementById("zLight").checked == true) {
		unitOptions += ',"light":true';
	}
	else {
		unitOptions += ',"light":false';
	}
	if (document.getElementById("zHeavy").checked == true) {
		unitOptions += ',"heavy":true';
	}
	else {
		unitOptions += ',"heavy":false';
	}
	if (archerWorld == true) {
		if (document.getElementById("zArcher").checked == true) {
			unitOptions += ',"archer":true';
		}
		else {
			unitOptions += ',"archer":false';
		}
		if (document.getElementById("zMarcher").checked == true) {
			unitOptions += ',"marcher":true';
		}
		else {
			unitOptions += ',"marcher":false';
		}
	}
	unitOptions += "}";
	localStorage.setItem("zUnitOptions", unitOptions);
}

function getSettings() {
	let maxAwayTime = localStorage.getItem("zMaxAwayTime");
	if (maxAwayTime == null) {
		maxAwayTime = 99;
		localStorage.setItem("zMaxAwayTime", maxAwayTime);
	}
	let unitOptions = localStorage.getItem("zUnitOptions");
	if (unitOptions == null) {
		unitOptions = {"spear":true, "sword":true, "axe":true, "archer":false, "light":false, "marcher":false, "heavy":true};
		unitOptionsString = JSON.stringify(unitOptions);
		localStorage.setItem("zUnitOptions", unitOptionsString);
	}
	else {
		unitOptions = JSON.parse(unitOptions);
	}
	return {"max_away_time": maxAwayTime, "unit_options": unitOptions};
}

(function () {
	UI.SuccessMessage('Script running');
	if (DEBUG) {
		console.debug(`${scriptName} World:`, game_data.world);
		console.debug(`${scriptName} Game Version:`, game_data.majorVersion);
		console.debug(`${scriptName} Game Build:`, game_data.version);
		console.debug(`${scriptName} Locale:`, game_data.locale);
		console.debug(`${scriptName} Premium:`, game_data.features.Premium.active);
	}

	if (game_data.features.Premium.active) {
		if (DEBUG) {
			console.debug(`${scriptName} Initializing Mass Scavenge script...`);
		}
		if (game_data.units.includes('archer')) {
			archerWorld = true;
		}
		imageList.push("https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_spear.png");
		imageList.push("https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_sword.png");
		imageList.push("https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_axe.png");
		imageList.push("https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_archer.png");
		imageList.push("https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_light.png");
		imageList.push("https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_marcher.png");
		imageList.push("https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_heavy.png");
		imageList.push("https://dsen.innogamescdn.com/asset/cf2959e7/graphic/border/frame-gold-red.png");
		imageList.push("https://dsen.innogamescdn.com/asset/ed7de11c/graphic/unit/unit_militia.png");
		runMassScavenge();
	} else {
		if (DEBUG) {
			console.debug(`${scriptName} Premium account required`);
		}
		UI.ErrorMessage('Premium Account is required for this script to run!');
	}
})();
