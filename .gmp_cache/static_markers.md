# Customize a Marker on a Map

## Overview

In the Maps Static API, you can customize the appearance of map markers using
the `markers` URL parameter. Customization options include changing the size,
color, and alphanumeric label of standard Google markers, or replacing the
standard pin entirely with a custom icon hosted at a public URL.

All markers defined within a single `markers` parameter must share the same
visual style. To display markers with different styles on the same map, append
multiple `markers` parameters to your request URL.

## Prerequisites

Before customizing a marker, ensure you understand how to construct a basic Maps
Static API URL and
[add a marker to a map](https://developers.google.com/maps/documentation/maps-static/start#Markers).
You also need a valid **API Key** and, if required, a **Digital Signature**.

--------------------------------------------------------------------------------

## Syntax and Ordering Rules

The `markers` parameter accepts a set of style descriptors followed by one or
more locations, all separated by the pipe character (`|`), which must be
URL-encoded as `%7C` in the final request:

```text
markers=markerStyles|markerLocation1|markerLocation2|...
```

### Critical Ordering Rule

Because both style descriptors and location coordinates/addresses are separated
by the pipe character (`|`), **all style descriptors must appear first** in the
`markers` declaration. Once the Maps Static API server encounters a location in
the descriptor, all subsequent pipe-separated parameters in that `markers` block
are treated as locations.

--------------------------------------------------------------------------------

## Option 1: Customize Standard Marker Styles

You can modify standard Google map pins using key-value pairs separated by pipes
(`|` or `%7C`).

### Style Descriptors

| Descriptor  | Accepted Values              | Notes & Constraints             |
| :---------- | :--------------------------- | :------------------------------ |
| **`size`**  | `tiny`, `mid`, `small`       | Optional. If omitted, the       |
:             :                              : marker renders at its default   :
:             :                              : (normal) size.                  :
| **`color`** | 24-bit hex (`0xFFFFCC`) or   | Optional. **Note:** 32-bit hex  |
:             : predefined\: `{black, brown, : color values (alpha             :
:             : green, purple, yellow, blue, : transparency) are *not*         :
:             : gray, orange, red, white}`   : supported for markers.          :
| **`label`** | Single **uppercase**         | Optional. Only supported on     |
:             : alphanumeric character\:     : **default** (normal) and        :
:             : `{A-Z, 0-9}`                 : **`mid`** sized markers. `tiny` :
:             :                              : and `small` markers cannot      :
:             :                              : display labels.                 :
| **`scale`** | `1`, `2`, `4`                | Optional (default `1`).         |
:             :                              : Multiplies the marker image     :
:             :                              : size for high-resolution        :
:             :                              : displays. Use in conjunction    :
:             :                              : with the map's main `scale`     :
:             :                              : parameter.                      :

### Examples: Standard Marker Customization

#### 1. Multiple Locations Sharing One Custom Style

This example places three blue markers labeled "S" across three different zip
codes in Brooklyn, NY:

```html
<img src="https://maps.googleapis.com/maps/api/staticmap?center=Williamsburg,Brooklyn,NY&zoom=13&size=400x400&markers=color:blue%7Clabel:S%7C11211%7C11206%7C11222&key=YOUR_API_KEY&signature=YOUR_SIGNATURE&solution_id=gmp_git_agentskills_v1" alt="Map with blue S markers" />
```

#### 2. Multiple Markers with Different Styles

To display markers with different styles, supply multiple `markers` parameters.
This example displays:

1.  A default-sized blue marker labeled `S` at `62.107733,-145.541936`.
2.  A tiny green marker (no label) at `Delta Junction, AK`.
3.  A mid-sized yellow (`0xFFFF00`) marker labeled `C` at `Tok, AK`.

```html
<img src="https://maps.googleapis.com/maps/api/staticmap?center=63.259591,-144.667969&zoom=6&size=400x400&markers=color:blue%7Clabel:S%7C62.107733,-145.541936&markers=size:tiny%7Ccolor:green%7CDelta+Junction,AK&markers=size:mid%7Ccolor:0xFFFF00%7Clabel:C%7CTok,AK&key=YOUR_API_KEY&signature=YOUR_SIGNATURE&solution_id=gmp_git_agentskills_v1" alt="Map with multiple marker styles" />
```

--------------------------------------------------------------------------------

## Option 2: Use Custom Icons

Instead of Google's standard marker pins, you can supply your own custom images
using the `icon` and `anchor` descriptors.

### Custom Icon Descriptors

*   **`icon:`** Specifies the publicly accessible URL of the icon image (must be
    URL-encoded).
*   **`anchor:`** (Optional) Sets how the icon is positioned relative to the
    specified marker location. By default, the anchor point is the `bottom`
    center of the icon image.
    *   **Predefined values:** `top`, `bottom`, `left`, `right`, `center`,
        `topleft`, `topright`, `bottomleft`, `bottomright`.
    *   **Coordinate values:** An `x,y` pixel point on the icon (e.g.,
        `anchor:10,5`).
*   **`scale:`** (Optional) Accepted values are `1`, `2`, and `4`.

### Custom Icon Constraints & Limits

*   **Formats:** PNG (recommended), JPEG, or GIF.
*   **Size Limit:** Up to **4096 pixels** maximum total size (e.g., `64x64` for
    square images). The 4096-pixel limit applies *after* `scale` is applied
    (e.g., if `scale:2` is set, the source image can be larger than 4096 pixels
    as long as the scaled reduction is under 4096 pixels).
*   **Unique Icon Limit:** You can use up to **5 unique custom icons** per
    request. However, each unique icon can be applied to multiple locations on
    the map.

### Examples: Custom Icons

#### 1. Custom Icons with Custom Anchors

This example places custom icons at three locations in Australia, using both
coordinate (`32,10`) and predefined (`topleft`, `topright`) anchor alignments:

```html
<img src="https://maps.googleapis.com/maps/api/staticmap?size=600x400&markers=anchor:32,10%7Cicon:https://goo.gl/5y3S82%7CCanberra+ACT&markers=anchor:topleft%7Cicon:http://tinyurl.com/jrhlvu6%7CMelbourne+VIC&markers=anchor:topright%7Cscale:2%7Cicon:https://goo.gl/1oTJ9Y%7CSydney+NSW&key=YOUR_API_KEY&signature=YOUR_SIGNATURE&solution_id=gmp_git_agentskills_v1" alt="Map with custom anchored icons" />
```

#### 2. Custom Icon with Default Anchor

If you omit the `anchor` descriptor, the icon defaults to anchoring at the
bottom center of the image:

```html
<img src="https://maps.googleapis.com/maps/api/staticmap?size=600x400&markers=icon:https://goo.gl/5y3S82%7CCanberra+ACT%7CMelbourne+VIC&key=YOUR_API_KEY&signature=YOUR_SIGNATURE&solution_id=gmp_git_agentskills_v1" alt="Map with default anchored custom icons" />
```

--------------------------------------------------------------------------------

## Programmatic URL Construction (JavaScript)

When building Maps Static API URLs dynamically, always ensure that pipe
characters (`|`), addresses, and custom icon URLs are properly URL-encoded.

```javascript
function buildCustomMarkerMapUrl(apiKey) {
  const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';

  // Define distinct marker groups
  const blueMarkers = 'color:blue|label:A|40.714728,-73.998672|40.718217,-73.998284';
  const customIconMarker = 'anchor:center|icon:https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png|40.712776,-74.005974';

  const params = new URLSearchParams({
    size: '600x400',
    scale: '2',
    key: apiKey,
    solution_id: 'gmp_git_agentskills_v1'
  });

  // Append multiple 'markers' parameters (URLSearchParams automatically encodes '|' to '%7C')
  params.append('markers', blueMarkers);
  params.append('markers', customIconMarker);

  return `${baseUrl}?${params.toString()}`;
}
```

--------------------------------------------------------------------------------

## Common Pitfalls & Troubleshooting

1.  **Unencoded Pipe Characters (`|`):** Always encode `|` as `%7C` in
    production URLs. Unencoded pipes can break URL parsing in certain browsers
    or HTTP clients.
2.  **Label Not Appearing:**
    *   Check the marker `size`. Labels **do not** render on `tiny` or `small`
        markers.
    *   Ensure the label is a **single uppercase** character (`A-Z` or `0-9`).
        Lowercase letters or multi-character strings will fail to render
        properly.
3.  **Transparency in Marker Colors:** Passing a 32-bit hex value (e.g.,
    `color:0xFF000080`) will fail or be ignored. Alpha transparency is only
    supported on `path` parameters, not `markers`.
4.  **Styles Ignored / Treated as Locations:** Ensure every style descriptor
    (`size:`, `color:`, `label:`, `icon:`, `anchor:`) is placed *before* the
    first location in the `markers` string.
5.  **Geocoding Limit Exceeded:** If you specify marker locations using
    human-readable addresses (e.g., `"City Hall, New York, NY"`) instead of
    `lat,lng` coordinates, the request is limited to a maximum of **15 geocoded
    locations**.
6.  **URL Length Limit:** Maps Static API URLs are restricted to **16,384
    characters**. Keep custom icon URLs concise (or use URL shorteners) if
    adding many markers.
