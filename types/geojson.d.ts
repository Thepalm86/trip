declare module 'geojson' {
  export = GeoJSON

  namespace GeoJSON {
    type Position = number[]

    type BBox =
      | [number, number, number, number]
      | [number, number, number, number, number, number]

    interface GeoJsonObject {
      type: string
      bbox?: BBox
    }

    interface GeometryObject extends GeoJsonObject {
      coordinates: any
    }

    interface Point extends GeometryObject {
      type: 'Point'
      coordinates: Position
    }

    interface MultiPoint extends GeometryObject {
      type: 'MultiPoint'
      coordinates: Position[]
    }

    interface LineString extends GeometryObject {
      type: 'LineString'
      coordinates: Position[]
    }

    interface MultiLineString extends GeometryObject {
      type: 'MultiLineString'
      coordinates: Position[][]
    }

    interface Polygon extends GeometryObject {
      type: 'Polygon'
      coordinates: Position[][]
    }

    interface MultiPolygon extends GeometryObject {
      type: 'MultiPolygon'
      coordinates: Position[][][]
    }

    interface GeometryCollection extends GeoJsonObject {
      type: 'GeometryCollection'
      geometries: Geometry[]
    }

    type Geometry =
      | Point
      | MultiPoint
      | LineString
      | MultiLineString
      | Polygon
      | MultiPolygon
      | GeometryCollection

    type GeoJsonProperties = { [key: string]: any } | null

    interface Feature<
      G extends Geometry | null = Geometry | null,
      P = GeoJsonProperties
    > extends GeoJsonObject {
      type: 'Feature'
      geometry: G
      properties: P
      id?: string | number
    }

    interface FeatureCollection<
      G extends Geometry | null = Geometry | null,
      P = GeoJsonProperties
    > extends GeoJsonObject {
      type: 'FeatureCollection'
      features: Array<Feature<G, P>>
    }

    type GeoJSON = GeoJsonObject
  }
}
