var mymap = L.map('mapid').setView([48.5166, 10.45898], 5);

L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    maxZoom: 18,
    id: 'mapbox.streets-satellite',
    accessToken: 'pk.eyJ1IjoiZHNoaXJlIiwiYSI6ImNqNm5vbXNheTBhbnEycXBieWhwNmw2ZTEifQ.Xsuz8-0E3C7AclNDX02AoQ'
    // accessToken: secrets.mapToken
}).addTo(mymap);

var germany = L.circle([50.89921, 10.2832], {
    color: 'white',
    fillColor: '#fefefe',
    fillOpacity: 0.5,
    radius: 350000
}).addTo(mymap);
germany.bindPopup("Germans love white asparagus.");

var austria = L.circle([47.5172, 14.67773], {
    color: 'white',
    fillColor: '#fefefe',
    fillOpacity: 0.5,
    radius: 200000
}).addTo(mymap);
austria.bindPopup("Austrians prefer white asparagus.");

var poland = L.circle([52.40242, 19.37988], {
    color: 'white',
    fillColor: '#fefefe',
    fillOpacity: 0.5,
    radius: 300000
}).addTo(mymap);
poland.bindPopup("Poland prefers white asparagus.");

var czech = L.circle([49.63918, 15.5127], {
    color: 'white',
    fillColor: '#fefefe',
    fillOpacity: 0.5,
    radius: 150000
}).addTo(mymap);
czech.bindPopup("The Czech Republic prefers white asparagus.");

var uk = L.circle([54.00777, -3.7793], {
    color: 'green',
    fillColor: 'rgb(70, 250, 66)',
    fillOpacity: 0.5,
    radius: 350000
}).addTo(mymap);
uk.bindPopup("The United Kingdom prefers green asparagus.");

var france = L.circle([47.60616, 2.94434], {
    color: 'green',
    fillColor: 'rgb(70, 250, 66)',
    fillOpacity: 0.5,
    radius: 400000
}).addTo(mymap);
france.bindPopup("The French prefer green asparagus.");


var italy = L.circle([45.67548, 10.19531], {
    color: 'green',
    fillColor: 'rgb(70, 250, 66)',
    fillOpacity: 0.5,
    radius: 250000
}).addTo(mymap);
italy.bindPopup("Italians prefer green asparagus.");
