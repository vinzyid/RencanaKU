<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\PrdVersion;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PrdVersionUniqueConstraintTest extends TestCase
{
    use RefreshDatabase;

    public function test_prd_versions_table_has_unique_index_on_project_id_and_version_number(): void
    {
        $indexes = collect(Schema::getIndexes('prd_versions'));

        $hasUnique = $indexes->contains(function ($idx) {
            return ($idx['unique'] ?? false)
                && in_array('project_id', $idx['columns'], true)
                && in_array('version_number', $idx['columns'], true);
        });

        $this->assertTrue($hasUnique, 'Composite unique index (project_id, version_number) is missing from prd_versions table.');
    }

    public function test_duplicate_version_number_for_same_project_is_rejected(): void
    {
        $user = User::factory()->create();
        $project = Project::create([
            'user_id' => $user->id,
            'title' => 'Test Project for Version Unique Constraint',
        ]);

        $project->prdVersions()->create([
            'version_number' => 1,
            'content' => json_encode(['title' => 'Version 1']),
            'status' => 'draft',
            'ai_provider' => 'local',
        ]);

        $this->expectException(QueryException::class);

        $project->prdVersions()->create([
            'version_number' => 1,
            'content' => json_encode(['title' => 'Duplicate Version 1']),
            'status' => 'draft',
            'ai_provider' => 'local',
        ]);
    }
}
