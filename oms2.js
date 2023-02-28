javascript:

var unitsHaulCapacity = [25, 15, 10, 10, 80, 50, 50];
var unitPop = [1, 1, 1, 1, 4, 5, 6];
var lootFactor = [0.1, 0.25, 0.5, 0.75];

var scriptData = {
	prefix: 'optimalMassScav',
	name: 'Optimal Mass Scavenging',
};

// Change to true to debug
if (typeof DEBUG !== 'boolean') DEBUG = false;
// if (typeof DEBUG !== 'boolean') DEBUG = true;

if (game_data.player.sitter > 0) {
	URLReq = `game.php?t=${game_data.player.id}&screen=place&mode=scavenge_mass`;
} else {
	URLReq = 'game.php?&screen=place&mode=scavenge_mass';
}

if (game_data.units.includes('archer')) {
	var archerWorld = true;
}
else {
	var archerWorld = false;
}

initDebug();

function initMassScavenge() {
	var amountOfPages = 0;
	URLs = [];
	jQuery
		.get(URLReq, function () {
			if (jQuery('.paged-nav-item').length > 0) {
				amountOfPages = parseInt(
					jQuery('.paged-nav-item')[jQuery('.paged-nav-item').length - 1].href.match(/page=(\d+)/)[1]
				);
			}
			for (var i = 0; i <= amountOfPages; i++) {
				URLs.push(URLReq + '&page=' + i);
			}
		})
		.done(function () {
			let arrayWithData = '[';
			let arrayWorldData = '[';
			jQuery.getAll(
				URLs,
				(_, data) => {
					worldData = jQuery(data)
						.find('script:contains("ScavengeMassScreen")')
						.html()
						.match(/\{.*\:\{.*\:.*\}\}/g)[0];
					arrayWorldData += worldData + ',';

					thisPageData = jQuery(data)
						.find('script:contains("ScavengeMassScreen")')
						.html()
						.match(/\{.*\:\{.*\:.*\}\}/g)[2];
					arrayWithData += thisPageData + ',';
				},
				() => {
					arrayWithData = arrayWithData.substring(0, arrayWithData.length - 1);
					arrayWithData += ']';

					arrayWorldData = arrayWorldData .substring(0, arrayWorldData .length - 1);
					arrayWorldData += ']';

					const scavengingInfo = JSON.parse(arrayWithData);
					const worldInfo = JSON.parse(arrayWorldData);
					const scavengeTable = [];

					scavengingInfo.forEach((scavObj) => {
						const { village_id, village_name, options, unit_counts_home } = scavObj;
						const tempOptions = [];
						const validOptions = [];
						const unitCounts = [];
						var anyAvailable = 0;
						for (let [_, value] of Object.entries(options)) {
							if ((value.scavenging_squad == null) && (value.is_locked == false)) {
								anyAvailable = 1;
								validOptions.push(value.base_id);
							}
						}
						if (anyAvailable == 1) {
							scavengeTable.push({
								village_id: village_id,
								village_name: village_name,
								option_id: validOptions,
								unit_counts: unit_counts_home
							});
						}
					});

					const durationFactor = worldInfo[0][1]["duration_factor"];
					const durationExponent = worldInfo[0][1]["duration_exponent"];


					if (DEBUG) {
						console.debug(`${scriptInfo()} scavengeTable :`, scavengeTable);
					}

					if (scavengeTable.length === 0) {
						UI.SuccessMessage('No scavenging options avaliable');
					} else {
						var htmlString = buildUI();
						var settings = getSettings();
						if (DEBUG) {
							console.debug(`${scriptInfo()} Settings: `, settings);
						}

						var requests = calculateOptimalSquads(settings, scavengeTable, amountOfPages, durationFactor, durationExponent);
						var groupNum = Object.keys(requests).length;

						if (DEBUG) {
							console.debug(`${scriptInfo()} requests :`, requests);
						}

						if (groupNum == 0) {
							UI.SuccessMessage('No scavenging options avaliable');
						} else {

						requests.forEach((request, i) => {
							const { village_id, village_name, option_id } = scavengeTable[i];
							var squadNum = Object.keys(request).length;

							htmlString += `
								<tr data-row-group-id="${i}">
									<td>
										<h4>
											${'Group '} ${i+1} ${'-'} ${squadNum} ${' squad(s)'}
										</h4>
									</td>
									<td class="ra-text-center">
										<a href="#" class="btn btn-confirm-yes btn-group-scav" group-id="${i}">
											${'Send'}
										</a>
									</td>
								</tr>
							`;
						});

						htmlString += `
								</tbody>
							</table>
						`;

						const content = `
							<div class="ra-villages-container">
								${htmlString}
							</div>
						`;

						renderUI(content);

						var checkboxValues = settings['unit_options'];
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
							if (DEBUG) {
								console.debug(`${scriptInfo()} Recalculating...:`);
							}
							getNewSettings();
							initMassScavenge();
						});

						sendSquadGroups(requests);
					}
				}
				},
				(error) => {
					console.error(error);
				}
			);
		});
}

$.getAll = function (urls, onLoad, onDone, onError) {
	var numDone = 0;
	var lastRequestTime = 0;
	var minWaitTime = 300;
	loadNext();
	function loadNext() {
		if (numDone == urls.length) {
			onDone();
			return;
		}
		let now = Date.now();
		let timeElapsed = now - lastRequestTime;
		if (timeElapsed < minWaitTime) {
			let timeRemaining = minWaitTime - timeElapsed;
			setTimeout(loadNext, timeRemaining);
			return;
		}
		lastRequestTime = now;
		$.get(urls[numDone]).done((data) => {
				try {
					onLoad(numDone, data);
					++numDone;
					loadNext();
				} catch (e) {
					onError(e);
				}
			})
			.fail((xhr) => {
				onError(xhr);
			});
	}
};

function renderUI(body) {
	if (DEBUG) {
		console.debug(`${scriptInfo()} Rendering UI...`);
	}
	const content = `
		<div class="ra-mass-scav vis" id="raMassScav">
		<h2 align="center"> <img src="https://dsen.innogamescdn.com/asset/ed7de11c/graphic/unit/unit_militia.png"> ${scriptData.name} <img src="https://dsen.innogamescdn.com/asset/ed7de11c/graphic/unit/unit_militia.png"></h2>
            <div class="ra-mass-scav-content">
                ${body}
            </div>
			<a class="popup_box_close custom-close-button" onClick="closeDraggableEl();" href="#">&nbsp;</a>
        </div>
        <style>
            .ra-mass-scav { position: fixed; z-index: 99999; top: 10vh; right: 10vw; display: block; width: 400px; height: auto; clear: both; margin: 0 auto 15px; padding: 10px; border: 1px solid #603000; box-sizing: border-box; background: #f4e4bc; }
			.ra-mass-scav * { box-sizing: border-box; }
			.custom-close-button { right: 0; top: 0; }
			.ra-mb14 { margin-bottom: 14px; }
			.ra-table { border-spacing: 2px; border-collapse: separate; border: 2px solid #f0e2be; }
			.ra-table th { text-align: center; }
            .ra-table td { padding: 1px 2px; }
            .ra-table td a { word-break: break-all; }
			.ra-table tr:nth-of-type(2n) td { background-color: #f0e2be }
			.ra-table tr:nth-of-type(2n+1) td { background-color: #fff5da; }
			.ra-text-left { text-align: left !important; }
			.ra-text-center { text-align: center; }
			.ra-villages-container { max-height: 300px; overflow-y: auto; overflow-x: hidden; }
        </style>
    `;

	if (jQuery('#raMassScav').length < 1) {
		jQuery('body').append(content);
		jQuery('#raMassScav').draggable();
	} else {
		jQuery('.ra-mass-scav-content').html(body);
	}
}

function calculateOptimalSquads(settings, scavengeTable, amountOfPages, durationFactor, durationExponent) {
	var scavengeTables = [];
	if (amountOfPages == 0) {
		scavengeTables.push(scavengeTable);
	}
	else {
		var pageIndex = 0;
		for (var page = 0; page <= amountOfPages; page++) {
			var slicedTable = [];
			for (var i = pageIndex*50; i < scavengeTable.length; i++) {
				pageIndex++;
				slicedTable.push(scavengeTable[i]);
			}
			scavengeTables.push(slicedTable);
	}
	}
	var requestList = [];
	for (var page = 0; page <= amountOfPages; page++) {
		var correctedDistributions = [];
		for (var i = 0; i < scavengeTables[page].length; i++) {
			var correctedDistribution = [];
			var initialized = initInitialDistribution(settings, scavengeTables[page][i].unit_counts);
			var initialDistribution = initialized[0];
			var remaining = initialized[1];
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
			var pop = calculatePop(allocated[0])
			var reallocate = []
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
			var sumReallocated = [];
			for (var unit = 0; unit < 7; unit++) {
				var sums = 0;
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
			var villageID = scavengeTables[page][i]["village_id"];
			correctedDistribution.unshift(villageID);
			correctedDistributions.push(correctedDistribution);
		}
		requests = [];

		correctedDistributions.forEach((village) => {
			var villageID = village[0];
			village[1].forEach((option, i) => {
				var sum = 0;
				option.forEach((unit) => {
					sum += unit;
				});
				if (sum != 0) {
					var request = { "villageId": villageID, "unitCounts": option, "optionId": i};
					requests.push(request);
				}
			});
		});

		var squadRequests = {};
		var squadRequestIndex = {};
		requests.forEach((request, i) => {
		const { villageId, unitCounts, optionId } = request;
		var candidateSquad = {
			'unit_counts': {
				'spear': unitCounts[0],
				'sword': unitCounts[1],
				'axe': unitCounts[2],
				'light': unitCounts[4],
				'heavy': unitCounts[6]
			},
			carry_max: 9999999999
		};
		var squadRequest = {
				'village_id': villageId,
				'candidate_squad': candidateSquad,
				'option_id': optionId+1,
				'use_premium': false,
		};
		squadRequestIndex[i] = squadRequest;
		squadRequests[i] = squadRequest;
		});
		requestList.push(squadRequests);
		}

	var requestLists = [];
	requestList.forEach((page) => {
		var pageNum = Object.keys(page).length;
		if (pageNum > 0) {
			requestLists.push(page)
		}

	});
	return requestLists;
}

function sendSquadGroups(requests, n) {
	jQuery('.btn-group-scav').on('click', function (e) {
		e.preventDefault();
		if (DEBUG) {
			console.debug(`${scriptInfo()} Sending group ${n}:`);
		}
		jQuery('.btn-group-scav').attr('disabled', 'disabled');
 		const groupId = jQuery(this).attr('group-id');
		requests.forEach((request, i) => {
			TribalWars.post(
			'scavenge_api',
			{ ajaxaction: 'send_squads'},
				{squad_requests: request}
			);
		setTimeout(() => {
			jQuery('.btn-group-scav').removeAttr('disabled');
		}, 300);
		jQuery(this).parent().parent().fadeOut(300);
		});
		UI.SuccessMessage('Squads sent');
	});
}

function calculatePop(unit_distribution) {
    var popCounts = [];
	for (var option = 0; option < 4; option++) {
		var pop = 0;
		for (var unit = 0; unit < 7; unit++) {
            pop += unit_distribution[option][unit] * unitPop[unit];
		}
		popCounts.push(pop);
	}
	return popCounts;
}

function initInitialDistribution(settings, units) {
    var distribution = [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
    ]
	var remaining = [];

	if (settings["max_away_time"]["spear"] == false) {
		remaining[0] = 0;
	}
	else {
		remaining[0] = units["spear"];
	}

	if (settings["max_away_time"]["sword"] == false) {
		remaining[1] = 0;
	}
	else {
		remaining[1] = units["sword"];
	}

	if (settings["max_away_time"]["axe"] == false) {
		remaining[2] = 0;
	}
	else {
		remaining[2] = units["axe"];
	}

	if (settings["max_away_time"]["light"] == false) {
		remaining[4] = 0;
	}
	else {
		remaining[4] = units["light"];
	}

	if (settings["max_away_time"]["heavy"] == false) {
		remaining[5] = 0;
	}
	else {
		remaining[5] = units["heavy"];
	}

	if (archerWorld){
		if (settings["max_away_time"]["archer"] == false) {
			remaining[3] = 0;
		}
		else {
			remaining[3] = units["archer"];
		}
		if (settings["max_away_time"]["marcher"] == false) {
			remaining[5] = 0;
		}
		else {
			remaining[5] = units["marcher"];
		}
	}
	else {
		remaining[3] = 0;
		remaining[5] = 0;
	}
    return [distribution, remaining];
}

function allocateUnits(maxScavHours, unit_distribution, remaining, options, durationFactor, durationExponent) {
	if (options.includes(true)) {
		for (var unit = 0; unit < 7; unit++) {
			var marginal = [0,0,0,0];
			var maxDuration = maxScavHours*3600;
			while (remaining[unit] > 0) {
				var initialRate = calculateTimeAndRate(unit_distribution, durationFactor, durationExponent)[0];
				for (var option = 0; option < 4; option++) {
					unit_distribution[option][unit] += 1;
					var timeAndRate = calculateTimeAndRate(unit_distribution, durationFactor, durationExponent);
					var newRate = timeAndRate[0];
					var newDuration = timeAndRate[1][option];
					unit_distribution[option][unit] -= 1;
					if (newDuration < maxDuration && options[option] == true) {
						marginal[option] = newRate - initialRate;
					}
					else {
						marginal[option] = 0;
					}
				}
				var sum = 0;
				var largestIncrease = 0;
				var max = 0;
				for (var option = 0; option < 4; option++) {
					sum += marginal[option];
					if (marginal[option] > largestIncrease) {
						largestIncrease = marginal[option];
						max = option;
					}
				}
				if (largestIncrease > 0) {
					unit_distribution[max][unit] += 1;
					remaining[unit] -= 1;
				}
				else {
					break;
				}
				}
		}
	}
    return [unit_distribution, remaining];
}

function calculateTimeAndRate(unit_distribution, durationFactor, durationExponent) {
    var rates = [0,0,0,0];
    var times = [0,0,0,0];
    var totalHaulCapacity = [0,0,0,0]; for (var option = 0; option < 4; option++) {
		for (var unit = 0; unit < 7; unit++) {
			var unitHaulCapacity = unitsHaulCapacity[unit]*unit_distribution[option][unit];
			totalHaulCapacity[option] += unitHaulCapacity;
		}
	}
	for (var option = 0; option < 4; option++) {
        var optionCap = totalHaulCapacity[option]*lootFactor[option];
		if (optionCap > 0) {
			times[option] = (Math.pow(10*optionCap, 2*durationExponent) + 1800) * durationFactor;
			rates[option] = optionCap / times[option];
		}
	}
	var totalRate = 0;
	for (var i = 0; i < 4; i++) {
		totalRate += rates[i];
	}
	return [totalRate, times];
}

function closeDraggableEl() {
	jQuery('#raMassScav').remove();
}

function scriptInfo() {
	return `[${scriptData.name}]`;
}

function initDebug() {
	if (DEBUG) {
		console.debug(`${scriptInfo()} Script working`);
		console.debug(`${scriptInfo()} World:`, game_data.world);
		console.debug(`${scriptInfo()} Game Version:`, game_data.majorVersion);
		console.debug(`${scriptInfo()} Game Build:`, game_data.version);
		console.debug(`${scriptInfo()} Locale:`, game_data.locale);
		console.debug(`${scriptInfo()} Premium:`, game_data.features.Premium.active);
	}
}

function buildUI() {
		if (archerWorld) {
            var htmlString = '<div  ID= scavTable >\
            <table align="center" class="zscavengeTable" width="15%" style="border: 7px solid rgba(121,0,0,0.71); border-image-slice: 7 7 7 7; border-image-source: url(https://dsen.innogamescdn.com/asset/cf2959e7/graphic/border/frame-gold-red.png);">\
               <tbody>\
                  <tr>\
                     <th style="text-align:center" colspan="13">Choose units to scavenge with</th>\
                  </tr>\
                  <tr>\
                     <th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="spear"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_spear.png" title="Spear fighter" alt="" class=""></a></th>\
                     <th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="sword"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_sword.png" title="Swordsman" alt="" class=""></a></th>\
                     <th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="axe"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_axe.png" title="Axeman" alt="" class=""></a></th>\
                     <th style="text-align:center" width="35"><a href="#" cl ass="unit_link" data-unit="archer"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_archer.png" title="Archer" alt="" class=""></a></th>\
                     <th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="light"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_light.png" title="Light cavalry" alt="" class=""></a></th>\
                     <th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="marcher"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_marcher.png" title="Mounted Archer" alt="" class=""></a></th>\
                     <th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="heavy"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_heavy.png" title="Heavy cavalry" alt="" class=""></a></th>\
                     <th style="text-align:center" nowrap>Max away time</th>\
                     <th style="text-align:center" nowrap>Apply new settings</th>\
                  </tr>\
                  <tr>\
                     <td align="center"><input type="checkbox" ID="zSpear" class="zSpear" name="spear" ></td>\
                     <td align="center"><input type="checkbox" ID="zSword" class="zSword" name="sword" ></td>\
                     <td align="center"><input type="checkbox" ID="zAxe" class="zAxe" name="axe" ></td>\
                     <td align="center"><input type="checkbox" ID="zArcher" class="zArcher" name="archer" ></td>\
                     <td align="center"><input type="checkbox" ID="zLight" class="zLight" name="light" ></td>\
                     <td align="center"><input type="checkbox" ID="zMarcher" class="zMarcher" name="marcher" ></td>\
                     <td align="center"><input type="checkbox" ID="zHeavy" class="zHeavy" name="heavy" ></td>\
                     <td ID="runtime" align="center"><input type="text" ID="zHours" class="zHours" name="hours" size="4" maxlength="5" align=left > hours</td>\
					 <td ID="recalculate-btn" align="center">\
						<a href="javascript" class="btn" id="recalculate">Recalculate</a>\
					 </td>\
               </tbody>\
            </table>\
            </br>\
         </div>\
         ';
        } else {
            var htmlString = '<div  ID= scavTable>\
            <table align="center" class="zscavengeTable" width="15%" style="border: 7px solid rgba(121,0,0,0.71); border-image-slice: 7 7 7 7; border-image-source: url(https://dsen.innogamescdn.com/asset/cf2959e7/graphic/border/frame-gold-red.png);">\
             <tbody>\
                  <tr>\
                     <th style="text-align:center" colspan="11">Choose units to scavenge with</th>\
                  </tr>\
                  <tr>\
                     <th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="spear"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_spear.png" title="Spear fighter" alt="" class=""></a></th>\
                     <th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="sword"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_sword.png" title="Swordsman" alt="" class=""></a></th>\
                     <th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="axe"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_axe.png" title="Axeman" alt="" class=""></a></th>\
                     <th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="light"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_light.png" title="Light cavalry" alt="" class=""></a></th>\
                     <th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="heavy"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_heavy.png" title="Heavy cavalry" alt="" class=""></a></th>\
                     <th style="text-align:center" nowrap>Max away time</th>\
                     <th style="text-align:center" nowrap>Apply new settings</th>\
                  </tr>\
                  <tr>\
                     <td align="center"><input type="checkbox" ID="zSpear" class="zSpear" name="spear" ></td>\
                     <td align="center"><input type="checkbox" ID="zSword" class="zSword" name="sword" ></td>\
                     <td align="center"><input type="checkbox" ID="zAxe" class="zAxe" name="axe" ></td>\
                     <td align="center"><input type="checkbox" ID="zLight" class="zLight" name="light" ></td>\
                     <td align="center"><input type="checkbox" ID="zHeavy" class="zHeavy" name="heavy" ></td>\
                     <td ID="runtime" align="center"><input type="text" ID="zHours" class="zHours" name="hours" size="2" maxlength="3" align=left > hours</td>\
					 <td ID="recalculate-btn" align="center">\
						<a href="javascript" class="btn" id="recalculate">Recalculate</a>\
					 </td>\
               </tbody>\
            </table>\
            </br>\
         </div>\
         ';
        }

	htmlString += `
		<table class="ra-table vis" width="100%">
			<tbody>
	`;
	return htmlString;
}

function getNewSettings() {
	if (DEBUG) {
		console.debug(`${scriptInfo()} Applying new settings...:`);
	}
	var maxAwayTime = Number(document.getElementById("zHours").value);

	var validNumber = isNaN(maxAwayTime);
	if (validNumber == false) {
		if (maxAwayTime > 0) {
			localStorage.setItem("zMaxAwayTime", maxAwayTime);
		}
	}

	var unitOptions = "{";

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
	if (DEBUG) {
		console.debug(`${scriptInfo()} Fetching settings from local storage...:`);
	}
	var maxAwayTime = localStorage.getItem("zMaxAwayTime");
	if (maxAwayTime == null) {
		maxAwayTime = 99;
		localStorage.setItem("zMaxAwayTime", maxAwayTime);
	}
	var unitOptions = localStorage.getItem("zUnitOptions");
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
	if (game_data.features.Premium.active) {
	// if (true) {
		if (DEBUG) {
			console.debug(`${scriptInfo()} Initializing script...:`);
		}
		initMassScavenge();
	} else {
		if (DEBUG) {
			console.debug(`${scriptInfo()} Premium account required`);
		}
		UI.ErrorMessage('Premium Account is required for this script to run!');
	}
})();
