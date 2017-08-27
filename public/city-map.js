var city = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
var geocoder;
var map;

function initMap() {
    geocoder = new google.maps.Geocoder();
    var latlng = new google.maps.LatLng(48.5166, 10.45898);
    var mapOptions = {
        zoom: 12,
        center: latlng
    };
    map = new google.maps.Map(document.getElementById('signerMap'), mapOptions);

    geocoder.geocode({
        'address': city
    }, function(results, status) {
        if (status == 'OK') {
            map.setCenter(results[0].geometry.location);
            var marker = new google.maps.Marker({
                map: map,
                position: results[0].geometry.location,
                animation: google.maps.Animation.DROP,
                title: city
            });
        } else {
            console.log('Geocode was not successful for the following reason: ' + status);
        }
    });

}
