attribute float t;
attribute float direction; 
// attribute vec3 position;
// attribute vec3 next;
// attribute vec3 previous;

uniform mat4 modelView;
uniform mat4 projection;
uniform float aspect;

uniform float thickness;
uniform int miter;

uniform int uNumControlPoints;
uniform vec3 uControlPoints[64];

varying lowp vec4 vColor;


#define MAX_K 128.0
#define MAX_K_i 128
float bernstein(int n, int k, float t) {
    float result = 1.0;
    for(int i = 1; i <= MAX_K_i; i++) {
        if (i > k) break;
        result *= float(n - (k - i)) / float(i);
    }
    float first = (k == 0) ? 1.0 : pow(t, float(k));
    float second = ((n - k) == 0) ? 1.0 : pow(1.0 - t, float(n-k));

    result *= first * second;
    return result;
}

vec3 bernstein3(float n, float k, float t1, float t2, float t3) {
    vec3 result = vec3(1.0, 1.0, 1.0);
    for(float i = 1.0; i <= MAX_K; i++) {
        if (i > k) break;
        result *= (n - (k - i)) / i;
    }

    vec3 first = (k == 0.0) ? vec3(1.0, 1.0, 1.0) : vec3(pow(t1, k), pow(t2, k), pow(t3, k));
    vec3 second = ((n - k) == 0.0) ? vec3(1.0, 1.0, 1.0) : vec3(pow(1.0-t1, n - k),pow(1.0-t2, n - k),pow(1.0-t3, n - k));
    result *= first * second;
    return result;
}

void main(void) {
    float tNow = t;
    float tPrev = max(tNow - .001, 0.0);
    float tNext = min(tNow + .001, 1.0);

    vec3 pprev = vec3(0.0, 0.0, 0.0);
    vec3 pnow = vec3(0.0, 0.0, 0.0);
    vec3 pnext = vec3(0.0, 0.0, 0.0);

    int n = uNumControlPoints - 1;
    for (int i = 0; i <= 128; ++i) {
        if (i > n) break;
        vec3 p_i = uControlPoints[i];
        vec3 theta = bernstein3(float(n), float(i), tPrev, tNow, tNext);
        pprev += p_i * theta[0];
        pnow += p_i * theta[1];
        pnext += p_i * theta[2];
    }
    
    vec2 aspectVec = vec2(aspect, 1.0);
    mat4 projViewModel = projection * modelView;
    vec4 previousProjected = projViewModel * vec4(pprev, 1.0);
    vec4 currentProjected = projViewModel * vec4(pnow, 1.0);
    vec4 nextProjected = projViewModel * vec4(pnext, 1.0);

    //get 2D screen space with W divide and aspect correction
    vec2 currentScreen = currentProjected.xy / currentProjected.w * aspectVec;
    vec2 previousScreen = previousProjected.xy / previousProjected.w * aspectVec;
    vec2 nextScreen = nextProjected.xy / nextProjected.w * aspectVec;

    float len = thickness;
    float orientation = direction;

    //starting point uses (next - current)
    vec2 dir = vec2(0.0);
    if (currentScreen == previousScreen) {
        dir = normalize(nextScreen - currentScreen);
    } 
    //ending point uses (current - previous)
    else if (currentScreen == nextScreen) {
        dir = normalize(currentScreen - previousScreen);
    }
    //somewhere in middle, needs a join
    else {
        //get directions from (C - B) and (B - A)
        vec2 dirA = normalize((currentScreen - previousScreen));
        if (miter == 1) {
            vec2 dirB = normalize((nextScreen - currentScreen));
            //now compute the miter join normal and length
            vec2 tangent = normalize(dirA + dirB);
            vec2 perp = vec2(-dirA.y, dirA.x);
            vec2 miter = vec2(-tangent.y, tangent.x);
            dir = tangent;
            len = thickness / dot(miter, perp);
        } else {
            dir = dirA;
        }
    }
    vec2 normal = vec2(-dir.y, dir.x);
    normal *= len/2.0;
    normal.x /= aspect;

    vec4 offset = vec4(normal * orientation, 0.0, 1.0);
    gl_Position = currentProjected + offset;
    gl_PointSize = 1.0;

    normal = normalize(normal);
    vColor = vec4(abs(normal.x), abs(normal.y), abs(.5 - normal.x * normal.y), 1.0);
}