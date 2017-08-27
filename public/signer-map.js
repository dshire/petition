var cities = [];
$('.cities').each(function() {
    cities.push($(this).html());
});
cities = unique(cities);
var list = ['London', 'Berlin']
var gMarkers = [];
var geocoder;
var map;
var bounds;

function initMap() {
    geocoder = new google.maps.Geocoder();
    var latlng = new google.maps.LatLng(48.5166, 10.45898);
    var mapOptions = {
        zoom: 4,
        center: latlng
    }
    map = new google.maps.Map(document.getElementById('signerMap'), mapOptions);
    bounds = new google.maps.LatLngBounds();

    var markersDone = 0;
    list.forEach(function(city) {
        geocoder.geocode({
            'address': city
        }, function(results, status) {
            if (status == 'OK') {
                var marker = new google.maps.Marker({
                    map: map,
                    position: results[0].geometry.location,
                    animation: google.maps.Animation.DROP,
                    title: city
                });
                gMarkers.push(marker);
                loc = new google.maps.LatLng(marker.position.lat(), marker.position.lng());
                bounds.extend(loc);
                markersDone++;
                if (markersDone === list.length) {
                    setCenter();
                }
            } else {
                console.log('Geocode was not successful for the following reason: ' + status);
            }
        });
    });
}

console.log(cities);

function unique(list) {
    var result = [];
    $.each(list, function(i, e) {
        if ($.inArray(e, result) == -1) result.push(e);
    });
    return result;
}

function setCenter() {
    map.fitBounds(bounds);
    map.panToBounds(bounds);
}

var lastInfo;
$('.info-box').click(event, function() {
    var city = $(event.currentTarget).find('.cities').html();
    var html = $(event.currentTarget).html();
    gMarkers.forEach(function(e) {
        if (e.title == city) {
            closeInfoWindow();
            var infowindow = new google.maps.InfoWindow({
                content: '<div class="info-window">' + html + '</div>'
            });

            e.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(function() {
                e.setAnimation(null);
            }, 750);

            infowindow.open(map, e);
            lastInfo = infowindow;
        }
    });

});

function closeInfoWindow() {
    if (lastInfo) {
        lastInfo.close();
    }
}
