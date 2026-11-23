import * as THREE from "three";
import terrain from "../../../src/map/terrain.json";
import { Terrain } from "../../../src/terrain";

describe("Terrain", () => {
    test("is flat without terrain data", () => {
        const flat = new Terrain(null);
        expect(flat.top).toBe(0);
        expect(flat.heightAt(0, 0)).toBe(0);
        expect(flat.heightAt(5000, -3000)).toBe(0);
    });

    test("covers the town hall with the map's terrain", () => {
        const ground = new Terrain(terrain);
        expect(ground.top).toBeGreaterThan(0);
        expect(ground.extent.containsPoint(new THREE.Vector2(0, 0))).toBe(true);
        const height = ground.heightAt(0, 0);
        expect(height).toBeGreaterThanOrEqual(0);
        expect(height).toBeLessThanOrEqual(ground.top);
    });

    test("holds the height at the edge beyond the grid", () => {
        const ground = new Terrain(terrain);
        const { min } = ground.extent;
        expect(ground.heightAt(min.x - 1000, min.y - 1000)).toBeCloseTo(
            ground.heightAt(min.x, min.y),
        );
    });
});
