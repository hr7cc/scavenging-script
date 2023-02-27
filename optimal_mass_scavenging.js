javascript:

var unit_haul_capacity = [25, 15, 10, 10, 50, 80, 50, 100];
var unit_pop = [1, 1, 1, 1, 4, 6, 5, 10];
var loot_factor = [0.1, 0.25, 0.5, 0.75];

var scriptData = {
	prefix: 'optimalMassScav',
	name: 'Optimal Mass Scavenging',
	version: 'v1',
	author: 'me',
	authorUrl: 'https://youtube.com/',
	helpLink: 'https://google.com/',
};

// User Input
if (typeof DEBUG !== 'boolean') DEBUG = false;
// if (typeof DEBUG !== 'boolean') DEBUG = true;
var maxScavHours = 6;

// Define main mass scav url
if (game_data.player.sitter > 0) {
	URLReq = `game.php?t=${game_data.player.id}&screen=place&mode=scavenge_mass`;
} else {
	URLReq = 'game.php?&screen=place&mode=scavenge_mass';
}

// Init Debug
initDebug();

// Initialize mass scavenging unlock
function initMassScavengeUnlock() {

	UI.SuccessMessage('Optimal Mass Scavenging script is running!');
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
					UI.SuccessMessage('Fetching data...');
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
						if (DEBUG) {
							console.debug(`${scriptInfo()} scavObj:`, scavObj);
						}

						const { village_id, village_name, options, unit_counts_home } = scavObj;
						const tempOptions = [];
						const validOptions = [];
						const unitCounts = [];
						var anyAvailable = 0;
						for (let [_, value] of Object.entries(options)) {
							if ((value.scavenging_squad === null) && (value.is_locked === false)) {
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
						UI.SuccessMessage('Calculating squads...');
						let htmlString = `
								<div  ID= scavTable>\
								<table class="scavengeTable" width="15%" style="border: 7px solid rgba(121,0,0,0.71); border-image-slice: 7 7 7 7; border-image-source: url(https://dsen.innogamescdn.com/asset/cf2959e7/graphic/border/frame-gold-red.png);">\
								<tbody>\
									<tr>\
										<th style="text-align:center" colspan="11">Select unittypes to scavenge with</th>\
									</tr>\
									<tr>\
										<th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="spear"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_spear.png" title="Spear fighter" alt="" class=""></a></th>\
										<th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="sword"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_sword.png" title="Swordsman" alt="" class=""></a></th>\
										<th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="axe"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_axe.png" title="Axeman" alt="" class=""></a></th>\
										<th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="light"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_light.png" title="Light cavalry" alt="" class=""></a></th>\
										<th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="heavy"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_heavy.png" title="Heavy cavalry" alt="" class=""></a></th>\
										<th style="text-align:center" nowrap>Target runtime</th>\
										<th style="text-align:center" nowrap>Total uses by everyone</th>\
									</tr>\
									<tr>\
										<td align="center"><input type="checkbox" ID="spear" name="spear"></td>\
										<td align="center"><input type="checkbox" ID="sword" name="sword" ></td>\
										<td align="center"><input type="checkbox" ID="axe" name="axe" ></td>\
										<td align="center"><input type="checkbox" ID="light" name="light" ></td>\
										<td align="center"><input type="checkbox" ID="heavy" name="heavy" ></td>\
										<td ID="runtime" align="center"><input type="text" ID="hours" name="hours" size="4" maxlength="5" align=left > hours</td>\
										<td id="countScript"  align="center"></td>\
								</tbody>\
								</table>\
								</br>\
							</div>\
							<table class="ra-table vis" width="100%">
								<thead>
									<th class="ra-text-left">
										${'Group'}
									</th>
									<th>
										${'Send'}
									</th>
								</thead>
								<tbody>
						`;


						var requests = calculateOptimalSquads(scavengeTable, amountOfPages, durationFactor, durationExponent);

						var groupNum = Object.keys(requests).length;

						if (DEBUG) {
							console.debug(`${scriptInfo()} requests :`, requests);
						}

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
										<a href="#" class="btn btn-group-scav" group-id="${i}">
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
							<div class="ra-mb14">
								<p><b>${'Groups: '}</b> ${groupNum}</p>
							</div>
							<h4 style="display:none;" class="ra-success-message ra-mb14">
								<b>${'Script finished working!'}</b>
							</h4>
							<div class="ra-villages-container">
								${htmlString}
							</div>
						`;

						renderMassScanUnlockUI(content);
						sendSquadGroups(requests);
					}
				},
				(error) => {
					console.error(error);
				}
			);
		});
}

$.getAll = function (
	urls, // array of URLs
	onLoad, // called when any URL is loaded, params (index, data)
	onDone, // called when all URLs successfully loaded, no params
	onError // called when a URL load fails or if onLoad throws an exception, params (error)
) {
	var numDone = 0;
	var lastRequestTime = 0;
	var minWaitTime = 300; // ms between requests
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
		$.get(urls[numDone])
			.done((data) => {
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

// Render UI
function renderMassScanUnlockUI(body) {
	const content = `
		<div class="ra-mass-scav-unlock vis" id="raMassScavUnlock">
            <h3>${scriptData.name}</h3>
            <div class="ra-mass-scav-unlock-content">
                ${body}
            </div>
            <br>
            <small>
                <strong>
                    ${scriptData.name} ${scriptData.version}
                </strong> -
                <a href="${scriptData.authorUrl}" target="_blank" rel="noreferrer noopener">
                    ${scriptData.author}
                </a> -
                <a href="${scriptData.helpLink}" target="_blank" rel="noreferrer noopener">
                    ${'Help'}
                </a>
			</small>
			<a class="popup_box_close custom-close-button" onClick="closeDraggableEl();" href="#">&nbsp;</a>
        </div>
        <style>
            .ra-mass-scav-unlock { position: fixed; z-index: 99999; top: 10vh; right: 10vw; display: block; width: 400px; height: auto; clear: both; margin: 0 auto 15px; padding: 10px; border: 1px solid #603000; box-sizing: border-box; background: #f4e4bc; }
			.ra-mass-scav-unlock * { box-sizing: border-box; }
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

	if (jQuery('#raMassScavUnlock').length < 1) {
		jQuery('body').append(content);
		jQuery('#raMassScavUnlock').draggable();
	} else {
		jQuery('.ra-mass-scav-unlock-content').html(body);
	}
}

function calculateOptimalSquads(scavengeTable, amountOfPages, durationFactor, durationExponent) {

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
			const initialDistribution = initInitialDistribution(scavengeTables[page][i].unit_counts)[0];
			const options = [];
			var remaining = initInitialDistribution(scavengeTables[page][i].unit_counts)[1];
			for (var k = 1; k < 5; k++) {
				if (scavengeTables[page][i].option_id.includes(k)) {
					options.push(true);
				}
				else {
					options.push(false);
				}
			}
			const allocated = allocateUnits(initialDistribution, remaining, options, durationFactor, durationExponent);
			var pop = calculatePop(allocated[0])
			var reallocate = []
			for (var option = 0; option < 4; option++) {
				if (pop[option] != 0 && pop[option] < 10) {
					reallocate.push(allocated[0][option]);
					allocated[0][option] = [0,0,0,0,0,0,0,0];
					options[option] = false;
				}
				else {
					reallocate.push([0,0,0,0,0,0,0,0]);
				}
			}
			var sumReallocated = [];
			for (var unit = 0; unit < 8; unit++) {
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
				correctedDistribution.push(allocateUnits(allocated[0], sumReallocated, options)[0]);
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
				'heavy': unitCounts[5],
				'knight': unitCounts[7]
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


function sendSquadGroups(requests) {

	jQuery('.btn-group-scav').on('click', function (e) {
		e.preventDefault();
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
	});
}

function calculatePop(unit_distribution) {
    var popCounts = [];
	for (var option = 0; option < 4; option++) {
		var pop = 0;
		for (var unit = 0; unit < 8; unit++) {
            pop += unit_distribution[option][unit] * unit_pop[unit];
		}
		popCounts.push(pop);
	}
	return popCounts;
}

function initInitialDistribution(units) {
    var distribution = [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
    ]
	var remaining = [];

	remaining[0] = units["spear"];
	remaining[1] = units["sword"];
	remaining[2] = units["axe"];
	remaining[3] = units["archer"];
	remaining[4] = units["light"];
	remaining[5] = units["heavy"];
	remaining[6] = units["marcher"];
	remaining[7] = units["knight"];

	if (~window.game_data.units.includes('archer')){
		remaining[3] = 0;
		remaining[6] = 0;
	}
    return [distribution, remaining];
}

function allocateUnits(unit_distribution, remaining, options, durationFactor, durationExponent) {
	var maxDuration = 720000;
	if (options.includes(true)) {
		for (var unit = 0; unit < 8; unit++) {
			var marginal = [0,0,0,0];
			if (maxScavHours != 0) {
				maxDuration = maxScavHours*3600;
			}
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
		for (var unit = 0; unit < 8; unit++) {
			var unitHaulCapacity = unit_haul_capacity[unit]*unit_distribution[option][unit];
			totalHaulCapacity[option] += unitHaulCapacity;
		}
	}
	for (var option = 0; option < 4; option++) {
        var optionCap = totalHaulCapacity[option]*loot_factor[option];
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

// Helper: Close draggable element
function closeDraggableEl() {
	jQuery('#raMassScavUnlock').remove();
}

// Helper: Generates script info
function scriptInfo() {
	return `[${scriptData.name} ${scriptData.version}]`;
}

// Helper: Prints universal debug information
function initDebug() {
	console.debug(`${scriptInfo()} It works ðŸš€!`);
	console.debug(`${scriptInfo()} HELP:`, scriptData.helpLink);
	if (DEBUG) {
		console.debug(`${scriptInfo()} Market:`, game_data.market);
		console.debug(`${scriptInfo()} World:`, game_data.world);
		console.debug(`${scriptInfo()} Screen:`, game_data.screen);
		console.debug(`${scriptInfo()} Game Version:`, game_data.majorVersion);
		console.debug(`${scriptInfo()} Game Build:`, game_data.version);
		console.debug(`${scriptInfo()} Locale:`, game_data.locale);
		console.debug(`${scriptInfo()} Premium:`, game_data.features.Premium.active);
	}
}





// Initialize Script
(function () {
	if (game_data.features.Premium.active) {
		initMassScavengeUnlock();
	} else {
		UI.ErrorMessage('Premium Account is required for this script to run!');
	}
})();
